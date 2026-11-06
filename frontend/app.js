
const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let authMode = 'register';
let businessesCache = [];
let toastTimer;

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(value) || 0);

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 3200);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  let body = {};

  try {
    body = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(body.error || 'Request failed.');
  }

  return body;
}

function showModal(id) {
  $('#' + id).hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $('#' + id).hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => {
    closeModal(button.dataset.close);
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeModal(modal.id);
    }
  });
});

// AUTHENTICATION UI

function setAuthUI() {
  const button = $('#auth-button');

  $('#user-label').textContent =
    currentUser ? `Hi, ${currentUser.full_name}` : '';

  button.textContent = currentUser ? 'Log out' : 'Log in';

  $('#cta-register').textContent =
    currentUser ? 'You are signed in' : 'Create your free account';
}

function setAuthMode(mode) {
  authMode = mode;

  $('#auth-title').textContent =
    mode === 'register' ? 'Create your account' : 'Welcome back';

  $('#auth-submit').textContent =
    mode === 'register' ? 'Create account' : 'Log in';

  $('#name-field').hidden = mode === 'login';
  $('#name-field input').required = mode === 'register';

  $('#switch-copy').textContent =
    mode === 'register'
      ? 'Already have an account?'
      : 'New to SheRise?';

  $('#switch-auth').textContent =
    mode === 'register' ? 'Log in' : 'Create account';

  $('#auth-status').textContent = '';
  $('#auth-form').reset();
}

$('#switch-auth').addEventListener('click', () => {
  setAuthMode(authMode === 'register' ? 'login' : 'register');
});

$('#auth-button').addEventListener('click', async () => {
  if (currentUser) {
    try {
      await api('/auth/logout', { method: 'POST' });

      currentUser = null;
      setAuthUI();

      toast('You have logged out.');
    } catch (error) {
      toast(error.message);
    }
  } else {
    setAuthMode('login');
    showModal('auth-modal');
  }
});

$('#cta-register').addEventListener('click', () => {
  if (!currentUser) {
    setAuthMode('register');
    showModal('auth-modal');
  }
});

$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  const payload = {
    email: form.get('email'),
    password: form.get('password')
  };

  if (authMode === 'register') {
    payload.fullName = form.get('fullName');
  }

  const status = $('#auth-status');
  status.textContent = 'Please wait…';

  try {
    const result = await api(`/auth/${authMode}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    currentUser = result.user;

    setAuthUI();
    closeModal('auth-modal');

    toast(
      authMode === 'register'
        ? 'Account created. Welcome to SheRise!'
        : 'Welcome back!'
    );

    await loadBusinesses();

  } catch (error) {
    status.textContent = error.message;
  }
});

async function loadSession() {
  try {
    const result = await api('/auth/me');
    currentUser = result.user;
  } catch {
    currentUser = null;
  }

  setAuthUI();
}

// SAFE TEXT

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

// MARKETPLACE

function renderBusinesses(items) {
  const grid = $('#marketplace-grid');

  if (!items.length) {
    grid.innerHTML =
      '<div class="empty-state">No listings found yet. Be the first to showcase a business.</div>';

    return;
  }

  grid.innerHTML = items.map(b => {
    const phone = String(b.contact_phone || '').replace(/\D/g, '');

    const phoneLink = phone ? `tel:+${phone}` : '';
    const whatsappLink = phone ? `https://wa.me/${phone}` : '';

    return `
      <article class="business-card">

        <span class="category">${safeText(b.category)}</span>

        <h3>${safeText(b.name)}</h3>

        <p>${safeText(b.description)}</p>

        <div class="business-meta">
          <span>
            ${safeText(b.product_name)} · ${safeText(b.city)}
          </span>

          <strong class="price">
            ${money(b.price)}
          </strong>
        </div>

        <div class="card-actions">

          ${
            phone
              ? `
                <a class="outline-button" href="${phoneLink}">
                  Call seller
                </a>

                <a class="button"
                   href="${whatsappLink}"
                   target="_blank"
                   rel="noopener noreferrer">
                  WhatsApp seller
                </a>
              `
              : `
                <span class="muted">
                  Phone contact not available
                </span>
              `
          }

          <button
            class="outline-button"
            data-enquire="${safeText(b.id)}">
            Send enquiry
          </button>

        </div>

      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-enquire]').forEach(button => {
    button.addEventListener('click', () => {
      sendInquiry(button.dataset.enquire);
    });
  });
}

async function loadBusinesses() {
  const params = new URLSearchParams();

  if ($('#market-search').value.trim()) {
    params.set('search', $('#market-search').value.trim());
  }

  if ($('#category-filter').value !== 'All') {
    params.set('category', $('#category-filter').value);
  }

  $('#marketplace-grid').innerHTML =
    '<p class="muted">Loading marketplace…</p>';

  try {
    const result = await api('/businesses?' + params.toString());

    businessesCache = result.businesses;

    renderBusinesses(businessesCache);

  } catch (error) {
    $('#marketplace-grid').innerHTML =
      `<div class="empty-state">${safeText(error.message)} Check your Supabase setup.</div>`;
  }
}

let searchTimer;

$('#market-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadBusinesses, 300);
});

$('#category-filter').addEventListener('change', loadBusinesses);

// SEND ENQUIRY

async function sendInquiry(id) {
  if (!currentUser) {
    setAuthMode('login');
    showModal('auth-modal');

    toast('Log in to contact a business.');

    return;
  }

  const message = prompt(
    'Write a short enquiry to the business owner:'
  );

  if (!message) return;

  try {
    await api(`/businesses/${encodeURIComponent(id)}/inquiries`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    toast('Your enquiry was sent.');

  } catch (error) {
    toast(error.message);
  }
}

// CREATE BUSINESS LISTING

function openListing() {
  if (!currentUser) {
    setAuthMode('register');
    showModal('auth-modal');

    toast('Create an account to publish your business.');

    return;
  }

  $('#listing-form').reset();
  $('#listing-status').textContent = '';

  showModal('listing-modal');
}

$('#add-listing').addEventListener('click', openListing);
$('#start-business').addEventListener('click', openListing);

$('#listing-form').addEventListener('submit', async event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  const payload = {
    name: form.get('name'),
    category: form.get('category'),
    description: form.get('description'),
    productName: form.get('productName'),
    price: form.get('price'),
    contactEmail: form.get('contactEmail'),
    contactPhone: form.get('contactPhone'),
    city: form.get('city')
  };

  $('#listing-status').textContent = 'Publishing…';

  try {
    await api('/businesses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    closeModal('listing-modal');

    toast('Your business listing is live!');

    await loadBusinesses();

  } catch (error) {
    $('#listing-status').textContent = error.message;
  }
});

// IDEA LAB

const ideaData = {
  crafts: [
    [
      'Custom gift studio',
      'Create personalized gift boxes, greeting cards or keepsakes. Start with a small catalogue and take made-to-order requests.'
    ],
    [
      'Handmade home decor',
      'Make simple wall art, candles or fabric decor. Photograph each item in natural light and calculate material costs.'
    ],
    [
      'Upcycled accessories',
      'Turn unused fabric or materials into useful accessories. Explain the sustainable story behind each product.'
    ]
  ],

  food: [
    [
      'Home bakery',
      'Begin with a focused menu of a few baked items. Check local food-safety and registration requirements before selling.'
    ],
    [
      'Regional snack boxes',
      'Offer small tasting boxes featuring regional snacks. Track ingredient, packaging and delivery costs carefully.'
    ],
    [
      'Meal-prep service',
      'Plan a limited weekly menu for a specific customer group. Check applicable food business rules first.'
    ]
  ],

  fashion: [
    [
      'Custom clothing studio',
      'Offer alterations, made-to-measure pieces or small-batch designs. Build a portfolio of your work.'
    ],
    [
      'Accessories label',
      'Create a focused range of scarves, bags or jewellery. Test designs with a small audience before expanding.'
    ],
    [
      'Wardrobe styling',
      'Offer virtual styling sessions and practical outfit planning based on a customer’s needs.'
    ]
  ],

  teaching: [
    [
      'Online tutoring',
      'Teach a subject you know well through small group or one-to-one sessions. Set clear learning goals.'
    ],
    [
      'Creative workshops',
      'Host beginner sessions in art, craft, language or other practical skills. Offer a sample workshop first.'
    ],
    [
      'Digital skills classes',
      'Teach basic computer, spreadsheet or online safety skills to a clearly defined learner group.'
    ]
  ],

  digital: [
    [
      'Social media support',
      'Help local businesses plan posts, write captions and maintain a simple content calendar.'
    ],
    [
      'Digital design service',
      'Create simple invitations, menus or social media graphics. Build a small sample portfolio.'
    ],
    [
      'Virtual assistant service',
      'Offer scheduling, document formatting or customer message organization for small businesses.'
    ]
  ],

  beauty: [
    [
      'Natural self-care gift sets',
      'Curate non-medical self-care kits with clear ingredient and supplier information. Follow applicable product rules.'
    ],
    [
      'Beauty services',
      'Offer a defined service menu based on your training and local licensing requirements.'
    ],
    [
      'Wellness workshops',
      'Run general workshops on relaxation or personal care without making medical claims.'
    ]
  ]
};

$('#generate-ideas').addEventListener('click', () => {
  const ideas = ideaData[$('#interest').value];

  $('#idea-results').innerHTML = ideas.map((item, index) => `
    <article class="idea-card">
      <h3>${index + 1}. ${safeText(item[0])}</h3>
      <p>${safeText(item[1])}</p>
    </article>
  `).join('');
});

$('#generate-ideas').click();

// BUSINESS GUIDE

function answerBusinessQuestion(question) {
  const search = question.toLowerCase();

  if (/price|profit|cost/.test(search)) {
    return 'List every cost: materials, packaging, delivery, platform fees and the value of your time. Add these to find your cost per item, then choose a selling price that leaves a sustainable margin. Try the Profit Calculator on this page.';
  }

  if (/market|promot|customer|sell/.test(search)) {
    return 'Start with one clear customer group. Share good product photos, explain what makes your offer useful, ask early customers for feedback and keep a simple record of enquiries and sales.';
  }

  if (/name|brand/.test(search)) {
    return 'Choose a short, easy-to-pronounce name that reflects your product and is easy to remember. Check that the name is not already being used before printing labels or creating accounts.';
  }

  if (/loan|fund|grant|money/.test(search)) {
    return 'Explore the Funding section for official starting points. Check current eligibility, repayment terms, fees and application requirements directly with the provider before sharing documents or accepting funding.';
  }

  if (/start|begin|idea/.test(search)) {
    return 'Begin with a small problem you can solve and a skill you already have. Talk to potential customers, test one simple offer, estimate costs and improve it using feedback before investing heavily.';
  }

  return 'Break your goal into a small first step: identify your customer, describe the product or service, estimate costs and ask a few potential customers for feedback. You can also explore the Idea Lab for starting points.';
}

$('#assistant-form').addEventListener('submit', event => {
  event.preventDefault();

  const question = $('#assistant-question').value.trim();

  if (!question) return;

  $('#assistant-answer').textContent =
    answerBusinessQuestion(question);

  $('#assistant-question').value = '';
});

// PROFIT CALCULATOR

$('#profit-form').addEventListener('submit', event => {
  event.preventDefault();

  const cost = Number($('#unit-cost').value);
  const other = Number($('#other-cost').value);
  const price = Number($('#selling-price').value);

  if (
    [cost, other, price].some(
      value => !Number.isFinite(value) || value < 0
    )
  ) {
    toast('Enter valid non-negative amounts.');
    return;
  }

  const profit = price - cost - other;

  $('#profit-result').innerHTML = `
    Estimated profit per item:
    <strong>${money(profit)}</strong>
    <span>
      (${profit < 0
        ? 'Estimated loss'
        : 'before any additional expenses or taxes'})
    </span>
  `;
});

$('#profit-form').dispatchEvent(
  new Event('submit', { cancelable: true })
);

// MENTORSHIP

$('#mentor-form').addEventListener('submit', async event => {
  event.preventDefault();

  if (!currentUser) {
    setAuthMode('login');
    showModal('auth-modal');

    toast('Log in to send a mentorship request.');

    return;
  }

  const form = new FormData(event.currentTarget);

  $('#mentor-status').textContent = 'Sending…';

  try {
    await api('/mentor-requests', {
      method: 'POST',
      body: JSON.stringify({
        topic: form.get('topic'),
        goals: form.get('goals'),
        preferredContact: form.get('preferredContact')
      })
    });

    event.currentTarget.reset();

    $('#mentor-status').textContent =
      'Your request has been submitted. Thank you!';

  } catch (error) {
    $('#mentor-status').textContent = error.message;
  }
});

// FUNDING RESOURCES

async function loadFunding() {
  try {
    const result = await api('/funding');

    $('#funding-list').innerHTML = result.resources.length
      ? result.resources.map(resource => `
          <article class="funding-card">

            <span class="category">
              ${safeText(resource.category)}
            </span>

            <h3>${safeText(resource.title)}</h3>

            <p>
              <strong>${safeText(resource.provider)}</strong>
            </p>

            <p>${safeText(resource.description)}</p>

            <p>
              <strong>Eligibility:</strong>
              ${safeText(resource.eligibility)}
            </p>

            ${
              resource.official_url
                ? `
                  <a href="${safeText(resource.official_url)}"
                     target="_blank"
                     rel="noopener noreferrer">
                    Visit official website ↗
                  </a>
                `
                : ''
            }

          </article>
        `).join('')
      : '<div class="empty-state">No resources are listed yet.</div>';

  } catch (error) {
    $('#funding-list').innerHTML =
      `<div class="empty-state">${safeText(error.message)}</div>`;
  }
}

// MOBILE MENU

$('#menu-toggle').addEventListener('click', () => {
  document.querySelector('.topbar nav').classList.toggle('open');
});

document.querySelectorAll('.topbar nav a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.topbar nav').classList.remove('open');
  });
});

// START APPLICATION

(async () => {
  await loadSession();

  await Promise.all([
    loadBusinesses(),
    loadFunding()
  ]);
})();
 