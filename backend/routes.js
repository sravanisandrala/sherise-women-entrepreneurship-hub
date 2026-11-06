
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

module.exports = ({ supabase }) => {
  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  });

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };

  const fail = (res, status, error) =>
    res.status(status).json({ error });

  const validEmail = (email) =>
    typeof email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    email.length <= 254;

  const text = (value, min, max) =>
    typeof value === 'string' &&
    value.trim().length >= min &&
    value.trim().length <= max;

  const validPhone = (phone) =>
    text(phone, 8, 20) &&
    /^\+?[0-9 ()-]{8,20}$/.test(phone.trim()) &&
    phone.replace(/\D/g, '').length >= 8;

  const tokenFor = (user) =>
    jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

  // AUTHENTICATION MIDDLEWARE
  async function requireAuth(req, res, next) {
    const token = req.cookies.sherise_token;

    if (!token) {
      return fail(res, 401, 'Please log in to continue.');
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const { data, error } = await supabase
        .from('users')
        .select('id,full_name,email')
        .eq('id', payload.sub)
        .maybeSingle();

      if (error) {
        console.error('Authentication database error:', error);
        return fail(res, 503, 'Could not verify your account.');
      }

      if (!data) {
        return fail(res, 401, 'Your session is no longer valid. Please log in again.');
      }

      req.user = data;
      next();

    } catch (error) {
      console.error('Authentication error:', error);
      return fail(res, 401, 'Your session is invalid or expired. Please log in again.');
    }
  }

  // REGISTER
  router.post('/auth/register', authLimiter, async (req, res) => {
    try {
      const { fullName, email, password } = req.body || {};

      if (
        !text(fullName, 2, 100) ||
        !validEmail(email) ||
        typeof password !== 'string' ||
        password.length < 8 ||
        password.length > 72
      ) {
        return fail(
          res,
          400,
          'Enter a name, valid email and password of 8–72 characters.'
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: existing, error: lookupError } =
        await supabase
          .from('users')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle();

      if (lookupError) {
        console.error('Registration lookup error:', lookupError);
        return fail(res, 503, 'Could not check the account. Verify your database setup.');
      }

      if (existing) {
        return fail(res, 409, 'An account with this email already exists.');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { data, error } = await supabase
        .from('users')
        .insert({
          full_name: fullName.trim(),
          email: normalizedEmail,
          password_hash: passwordHash
        })
        .select('id,full_name,email')
        .single();

      if (error) {
        console.error('Registration insert error:', error);
        return fail(res, 500, 'Could not create the account. Please try again.');
      }

      res.cookie('sherise_token', tokenFor(data), cookieOptions);
      return res.status(201).json({ user: data });

    } catch (error) {
      console.error('Registration error:', error);
      return fail(res, 500, 'Registration failed. Please try again.');
    }
  });

  // LOGIN
  router.post('/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (!validEmail(email) || typeof password !== 'string') {
        return fail(res, 400, 'Enter a valid email and password.');
      }

      const { data, error } = await supabase
        .from('users')
        .select('id,full_name,email,password_hash')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Login database error:', error);
        return fail(res, 503, 'Could not access accounts. Check your database connection.');
      }

      if (!data || !(await bcrypt.compare(password, data.password_hash))) {
        return fail(res, 401, 'Email or password is incorrect.');
      }

      res.cookie('sherise_token', tokenFor(data), cookieOptions);

      return res.json({
        user: {
          id: data.id,
          full_name: data.full_name,
          email: data.email
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      return fail(res, 500, 'Login failed. Please try again.');
    }
  });

  // LOGOUT
  router.post('/auth/logout', (_req, res) => {
    res.clearCookie('sherise_token', cookieOptions);
    res.json({ message: 'Logged out.' });
  });

  // CURRENT USER
  router.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  // MARKETPLACE - GET BUSINESSES
  router.get('/businesses', async (req, res) => {
    try {
      let query = supabase
        .from('businesses')
        .select('id,name,category,description,product_name,price,contact_email,contact_phone,city,created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (req.query.search) {
        const search = String(req.query.search).replace(/[(),]/g, '');

        query = query.or(
          `name.ilike.%${search}%,product_name.ilike.%${search}%`
        );
      }

      if (req.query.category && req.query.category !== 'All') {
        query = query.eq('category', req.query.category);
      }

      const { data, error } = await query.limit(100);

      if (error) {
        console.error('Business database error:', error);
        return fail(res, 503, 'Could not load marketplace listings.');
      }

      res.json({ businesses: data });

    } catch (error) {
      console.error('Business request error:', error);
      return fail(res, 500, 'Could not load marketplace listings.');
    }
  });

  // CREATE BUSINESS LISTING
  router.post('/businesses', requireAuth, async (req, res) => {
    try {
      const b = req.body || {};

      if (
        !text(b.name, 2, 100) ||
        !text(b.category, 2, 50) ||
        !text(b.description, 10, 1500) ||
        !text(b.productName, 2, 100) ||
        !Number.isFinite(Number(b.price)) ||
        Number(b.price) < 0 ||
        Number(b.price) > 100000000 ||
        !validEmail(b.contactEmail) ||
        !validPhone(b.contactPhone) ||
        !text(b.city, 2, 80)
      ) {
        return fail(res, 400, 'Please complete every field with valid values.');
      }

      const { data, error } = await supabase
        .from('businesses')
        .insert({
          owner_id: req.user.id,
          name: b.name.trim(),
          category: b.category.trim(),
          description: b.description.trim(),
          product_name: b.productName.trim(),
          price: Number(b.price),
          contact_email: b.contactEmail.trim().toLowerCase(),
          contact_phone: b.contactPhone.trim(),
          city: b.city.trim()
        })
        .select('id,name,category,description,product_name,price,contact_email,contact_phone,city,created_at')
        .single();

      if (error) {
        console.error('Create business error:', error);
        return fail(res, 500, 'Could not publish your listing.');
      }

      res.status(201).json({ business: data });

    } catch (error) {
      console.error('Create business request error:', error);
      return fail(res, 500, 'Could not publish your listing.');
    }
  });

  // MY BUSINESS LISTINGS
  router.get('/my/businesses', requireAuth, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('My businesses error:', error);
        return fail(res, 503, 'Could not load your listings.');
      }

      res.json({ businesses: data });

    } catch (error) {
      console.error('My businesses request error:', error);
      return fail(res, 500, 'Could not load your listings.');
    }
  });

  // DELETE BUSINESS
  router.delete('/businesses/:id', requireAuth, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', req.params.id)
        .eq('owner_id', req.user.id)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Delete business error:', error);
        return fail(res, 500, 'Could not delete listing.');
      }

      if (!data) {
        return fail(res, 404, 'Listing not found or you do not own it.');
      }

      res.json({ message: 'Listing deleted.' });

    } catch (error) {
      console.error('Delete business request error:', error);
      return fail(res, 500, 'Could not delete listing.');
    }
  });

  // BUSINESS INQUIRIES
  router.post('/businesses/:id/inquiries', requireAuth, async (req, res) => {
    try {
      if (!text(req.body?.message, 5, 1000)) {
        return fail(res, 400, 'Message must contain 5–1000 characters.');
      }

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id,owner_id')
        .eq('id', req.params.id)
        .eq('status', 'active')
        .maybeSingle();

      if (businessError) {
        console.error('Inquiry business lookup error:', businessError);
        return fail(res, 503, 'Could not find the business listing.');
      }

      if (!business) {
        return fail(res, 404, 'Business listing not found.');
      }

      if (business.owner_id === req.user.id) {
        return fail(res, 400, 'You cannot enquire about your own listing.');
      }

      const { data, error } = await supabase
        .from('inquiries')
        .insert({
          business_id: business.id,
          sender_id: req.user.id,
          message: req.body.message.trim()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Inquiry insert error:', error);
        return fail(res, 500, 'Could not send enquiry.');
      }

      res.status(201).json({
        inquiryId: data.id,
        message: 'Enquiry sent.'
      });

    } catch (error) {
      console.error('Inquiry request error:', error);
      return fail(res, 500, 'Could not send enquiry.');
    }
  });

  // MENTOR REQUESTS
  router.post('/mentor-requests', requireAuth, async (req, res) => {
    try {
      const b = req.body || {};

      if (
        !text(b.topic, 3, 120) ||
        !text(b.goals, 10, 1000) ||
        !text(b.preferredContact, 3, 150)
      ) {
        return fail(res, 400, 'Complete the topic, goals and preferred contact fields.');
      }

      const { data, error } = await supabase
        .from('mentor_requests')
        .insert({
          user_id: req.user.id,
          topic: b.topic.trim(),
          goals: b.goals.trim(),
          preferred_contact: b.preferredContact.trim()
        })
        .select('id,status,created_at')
        .single();

      if (error) {
        console.error('Mentor request error:', error);
        return fail(res, 500, 'Could not submit mentor request.');
      }

      res.status(201).json({ request: data });

    } catch (error) {
      console.error('Mentor request exception:', error);
      return fail(res, 500, 'Could not submit mentor request.');
    }
  });

  // FUNDING RESOURCES
  router.get('/funding', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('funding_resources')
        .select('id,title,provider,description,eligibility,official_url,category')
        .order('title');

      if (error) {
        console.error('Funding database error:', error);
        return fail(res, 503, 'Could not load funding resources.');
      }

      res.json({ resources: data });

    } catch (error) {
      console.error('Funding request error:', error);
      return fail(res, 500, 'Could not load funding resources.');
    }
  });

  return router;
};
 