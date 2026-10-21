const root = document.querySelector('#app');

let currentUser = null;
let csrf = '';
let categories = [];
let adminPosts = [];
let adminUsers = [];
let activeTab = 'posts';
let requestVersion = 0;

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const date = s =>
  s ? new Date(s).toLocaleDateString('vi-VN') : '';

const artTypes = {
  'Container': [
    'container',
    'IMAGE',
    'CONTAINER',
    'VOLUME'
  ],
  'Hạ tầng web': [
    'web',
    'REQUEST →',
    'NGINX',
    '← RESPONSE'
  ],
  'Dữ liệu': [
    'data',
    'DATABASE',
    'TABLE / ROW',
    'COMMIT'
  ],
  'Quan sát hệ thống': [
    'monitor',
    'METRICS',
    '▁ ▂ ▄ ▃ ▆',
    'OBSERVE'
  ],
  'Bảo mật': [
    'security',
    'IDENTITY',
    '••••••••',
    'PROTECTED'
  ]
};

function art(p) {
  const a = artTypes[p.category] || [
    'network',
    'NETWORK',
    'SERVICE',
    'CONNECT'
  ];

  return `
    <div class="art art-${a[0]}" aria-hidden="true">
      <div class="art-inner">
        ${a.slice(1).map(t => `<span>${t}</span>`).join('')}
      </div>
      <div class="art-label">
        MẠCH NGUỒN / ${a[0].toUpperCase()}
      </div>
    </div>
  `;
}

function notice(text) {
  const el = document.querySelector('#notice');

  el.textContent = text;
  el.classList.add('visible');

  setTimeout(() => {
    el.classList.remove('visible');
  }, 4500);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
      ...options.headers
    }
  });

  let data;

  try {
    data = await res.json();
  } catch {
    throw Error(
      'Máy chủ không trả về dữ liệu. Vui lòng thử lại.'
    );
  }

  if (!res.ok) {
    throw Error(data.error || 'Không thể xử lý yêu cầu');
  }

  return data;
}

async function session() {
  const s = await api('/api/session');

  csrf = s.csrf;
  currentUser = s.user;
}

function author(p) {
  const readingTime = Math.max(
    1,
    Math.ceil(p.content.split(/\s+/).length / 200)
  );

  return `
    <div class="byline">
      <span class="avatar">MN</span>
      <span>
        ${esc(p.author)}
        · ${date(p.published_at)}
        · ${readingTime} phút đọc
      </span>
    </div>
  `;
}

function card(p) {
  return `
    <a
      class="card"
      href="/bai-viet/${encodeURIComponent(p.slug)}"
    >
      ${art(p)}

      <div class="card-body">
        <span class="tag">${esc(p.category)}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.excerpt)}</p>
        ${author(p)}
      </div>
    </a>
  `;
}

async function home() {
  const version = ++requestVersion;
  const params = new URLSearchParams(location.search);

  const q = params.get('q') || '';
  const category = params.get('category') || '';

  const data = await api('/api/posts?' + params);

  if (version !== requestVersion) return;

  document.title = 'Mạch Nguồn — Hiểu công nghệ từ gốc';

  const first = data.items[0];
  const isDefault = !q && !category && data.page === 1;

  root.innerHTML = `
    <!-- BẮT ĐẦU PHẦN TIÊU ĐỀ: SỬA CHỮ TẠI ĐÂY -->
    <section class="hero">
      <div>
        <div class="eyebrow">
          Góc nhìn từ nền tảng
        </div>

        <h1>
          Hiểu công nghệ.<br>
          <em>Bắt đầu từ gốc.</em>
        </h1>

        <p>
          Những bài viết dễ hiểu về phát triển phần mềm,
          hạ tầng và dữ liệu. Kiến thức thực tế,
          nguồn thông tin rõ ràng.
        </p>
      </div>

      <aside class="hero-aside">
        <strong>01 — 06</strong>
        <p>
          Ghi chép công nghệ<br>
          Dành cho người ham tìm hiểu
        </p>
      </aside>
    </section>
    <!-- KẾT THÚC PHẦN TIÊU ĐỀ -->

    ${isDefault && first ? `
      <section class="featured">
        <div class="feature-body">
          <span class="tag">
            BÀI VIẾT NỔI BẬT · ${esc(first.category)}
          </span>

          <h2>
            <a href="/bai-viet/${esc(first.slug)}">
              ${esc(first.title)}
            </a>
          </h2>

          <p>${esc(first.excerpt)}</p>

          <a
            class="read-link"
            href="/bai-viet/${esc(first.slug)}"
          >
            Đọc câu chuyện <span>↗</span>
          </a>

          ${author(first)}
        </div>

        ${art(first)}
      </section>
    ` : ''}

    <div class="section-head">
      <h2>
        ${q ? 'Kết quả tìm kiếm' : 'Bài viết mới nhất'}
      </h2>
      <span>${data.total} bài viết có nguồn</span>
    </div>

    <div class="toolbar">
      <div class="chips">
        <button
          class="chip ${!category ? 'active' : ''}"
          data-category=""
        >
          Tất cả
        </button>

        ${categories.map(c => `
          <button
            class="chip ${
              category === String(c.id) ? 'active' : ''
            }"
            data-category="${c.id}"
          >
            ${esc(c.name)}
          </button>
        `).join('')}
      </div>

      <form id="search" class="search">
        <input
          name="q"
          value="${esc(q)}"
          placeholder="Tìm điều bạn muốn hiểu…"
          aria-label="Tìm bài viết"
        >
        <button aria-label="Tìm kiếm">⌕</button>
      </form>
    </div>

    <section class="grid">
      ${data.items.map(card).join('') || `
        <p class="empty">
          Chưa có bài viết phù hợp. Hãy thử từ khóa khác.
        </p>
      `}
    </section>

    ${data.pages > 1 ? `
      <div class="pagination">
        ${Array.from({ length: data.pages }, (_, i) => `
          <button
            class="chip ${data.page === i + 1 ? 'active' : ''}"
            data-page="${i + 1}"
          >
            ${i + 1}
          </button>
        `).join('')}
      </div>
    ` : ''}

    <div class="source-note">
      <strong>✓ Đọc có căn cứ</strong>
      <span>
        Nội dung được biên soạn bằng tiếng Việt từ tài liệu
        chính thức. Mỗi bài viết đều có liên kết để bạn
        kiểm chứng và tìm hiểu sâu hơn.
      </span>
    </div>
  `;

  root.querySelectorAll('[data-category]').forEach(b => {
    b.onclick = () => {
      navigateFilter('category', b.dataset.category);
    };
  });

  root.querySelectorAll('[data-page]').forEach(b => {
    b.onclick = () => {
      navigateFilter('page', b.dataset.page);
    };
  });

  root.querySelector('#search').onsubmit = e => {
    e.preventDefault();

    navigateFilter(
      'q',
      new FormData(e.target).get('q')
    );
  };
}

function navigateFilter(key, value) {
  const p = new URLSearchParams(location.search);

  if (value) {
    p.set(key, value);
  } else {
    p.delete(key);
  }

  if (key !== 'page') {
    p.delete('page');
  }

  history.pushState({}, '', '/?' + p);

  home().catch(showError);
}

async function article() {
  const slug = decodeURIComponent(
    location.pathname.split('/').pop()
  );

  const p = await api(
    '/api/posts/' + encodeURIComponent(slug)
  );

  document.title = p.title + ' | Mạch Nguồn';

  root.innerHTML = `
    <article class="article">
      <a class="back" href="/">← Trở về khám phá</a>

      <p>
        <span class="tag">${esc(p.category)}</span>
      </p>

      <h1>${esc(p.title)}</h1>
      <p class="lead">${esc(p.excerpt)}</p>

      ${author(p)}
      ${art(p)}

      <div class="prose">
        ${p.content
          .split(/\n\s*\n/)
          .map(t => `<p>${esc(t)}</p>`)
          .join('')}
      </div>

      ${p.source_url ? `
        <div class="source-box">
          <strong>Nguồn tham khảo chính thức</strong>
          <p>
            Bài viết được biên soạn,
            không phải bản trích nguyên văn.
          </p>

          <a
            href="${esc(p.source_url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${esc(new URL(p.source_url).hostname)} ↗
          </a>
        </div>
      ` : ''}

      <a class="btn secondary" href="/">
        Khám phá bài viết khác →
      </a>
    </article>
  `;
}

function login() {
  document.title = 'Đăng nhập quản trị | Mạch Nguồn';

  root.innerHTML = `
    <section class="login">
      <span class="tag">KHÔNG GIAN BIÊN TẬP</span>
      <h1>Chào mừng trở lại.</h1>

      <p>
        Đăng nhập để viết, biên tập và xuất bản nội dung.
      </p>

      <form id="login">
        <label for="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autocomplete="username"
          value="admin@blog.local"
        >

        <label for="password">Mật khẩu</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
        >

        <p
          id="login-error"
          class="error"
          role="alert"
        ></p>

        <button class="btn">Đăng nhập →</button>
      </form>

      <p>Mật khẩu được tạo khi cài đặt hệ thống.</p>
    </section>
  `;

  root.querySelector('#login').onsubmit = async e => {
    e.preventDefault();

    const b = e.target.querySelector('button');
    b.disabled = true;

    try {
      const s = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.target))
        )
      });

      currentUser = s.user;
      csrf = s.csrf;

      await admin();
    } catch (err) {
      root.querySelector('#login-error').textContent =
        err.message;

      b.disabled = false;
    }
  };
}

async function admin() {
  if (!currentUser) return login();

  document.title = 'Quản trị | Mạch Nguồn';

  categories = await api('/api/categories');

  root.innerHTML = `
    <section class="admin-title">
      <div>
        <h1>Không gian biên tập</h1>
        <p>
          ${esc(currentUser.name)}
          · ${
            currentUser.role === 'admin'
              ? 'Quản trị viên'
              : 'Biên tập viên'
          }
        </p>
      </div>

      <button id="logout" class="btn secondary">
        Đăng xuất
      </button>
    </section>

    <div class="tabs">
      <button
        data-tab="posts"
        class="chip ${activeTab === 'posts' ? 'active' : ''}"
      >
        Bài viết
      </button>

      ${currentUser.role === 'admin'
        ? ['categories', 'users'].map((t, i) => `
          <button
            data-tab="${t}"
            class="chip ${activeTab === t ? 'active' : ''}"
          >
            ${i ? 'Người dùng' : 'Danh mục'}
          </button>
        `).join('')
        : ''
      }

      <a class="chip" href="/" target="_blank">
        Xem website ↗
      </a>
    </div>

    <div id="admin-content"></div>
  `;

  root.querySelector('#logout').onclick = async () => {
    await api('/api/logout', { method: 'POST' });
    await session();
    login();
  };

  root.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => {
      activeTab = b.dataset.tab;
      admin().catch(showError);
    };
  });

  if (activeTab === 'posts') {
    await postsTable();
  } else if (activeTab === 'categories') {
    await categoriesTable();
  } else {
    await usersTable();
  }
}

const area = () => root.querySelector('#admin-content');

async function postsTable() {
  adminPosts = await api('/api/admin/posts');

  area().innerHTML = `
    <button class="btn" id="new-post">
      + Viết bài mới
    </button>

    <div id="editor-slot"></div>

    <p class="muted">
      ${adminPosts.length} bài viết
      · Bản nháp chỉ hiển thị trong quản trị
    </p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tiêu đề</th>
            <th>Danh mục</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>

        <tbody>
          ${adminPosts.map(p => `
            <tr>
              <td>
                ${esc(p.title)}
                <div class="muted">${esc(p.author)}</div>
              </td>

              <td>${esc(p.category)}</td>

              <td>
                <span class="status ${p.status}">
                  ${
                    p.status === 'published'
                      ? 'Đã xuất bản'
                      : 'Bản nháp'
                  }
                </span>
              </td>

              <td>
                <button
                  class="btn secondary"
                  data-edit="${p.id}"
                >
                  Sửa
                </button>

                <button
                  class="btn danger"
                  data-delete="${p.id}"
                >
                  Xóa
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  area().querySelector('#new-post').onclick = () => {
    editPost();
  };

  area().querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = () => {
      editPost(
        adminPosts.find(p => p.id === Number(b.dataset.edit))
      );
    };
  });

  area().querySelectorAll('[data-delete]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Xóa bài viết này?')) return;

      try {
        await api('/api/admin/posts/' + b.dataset.delete, {
          method: 'DELETE'
        });

        notice('Đã xóa bài viết');
        await postsTable();
      } catch (e) {
        notice(e.message);
      }
    };
  });
}

function editPost(p = {}) {
  document.querySelector('#editor-slot').innerHTML = `
    <form class="editor" id="post-form">
      <h2>
        ${p.id ? 'Biên tập bài viết' : 'Một câu chuyện mới'}
      </h2>

      <label for="title">Tiêu đề</label>
      <input
        id="title"
        name="title"
        required
        minlength="5"
        maxlength="180"
        value="${esc(p.title)}"
      >

      <label for="excerpt">Tóm tắt</label>
      <textarea
        id="excerpt"
        name="excerpt"
        rows="2"
        maxlength="500"
      >${esc(p.excerpt)}</textarea>

      <label for="content">Nội dung</label>
      <textarea
        id="content"
        name="content"
        rows="10"
        required
        minlength="30"
        maxlength="50000"
      >${esc(p.content)}</textarea>

      <p class="muted">
        Viết văn bản thuần; để một dòng trống giữa các đoạn.
        HTML được hiển thị như văn bản để bảo vệ người đọc.
      </p>

      <div class="row">
        <div>
          <label for="category">Danh mục</label>
          <select id="category" name="category_id">
            ${categories.map(c => `
              <option
                value="${c.id}"
                ${c.id === p.category_id ? 'selected' : ''}
              >
                ${esc(c.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div>
          <label for="status">Trạng thái</label>
          <select name="status" id="status">
            <option
              value="draft"
              ${p.status !== 'published' ? 'selected' : ''}
            >
              Bản nháp
            </option>

            <option
              value="published"
              ${p.status === 'published' ? 'selected' : ''}
            >
              Xuất bản
            </option>
          </select>
        </div>
      </div>

      <label for="source">Đường dẫn nguồn tham khảo</label>
      <input
        id="source"
        name="source_url"
        type="url"
        maxlength="1000"
        value="${esc(p.source_url)}"
        placeholder="https://..."
      >

      <div class="actions">
        <button class="btn" type="submit">
          Lưu bài viết
        </button>

        <button
          type="button"
          id="cancel"
          class="btn secondary"
        >
          Hủy
        </button>
      </div>

      <p class="error" id="form-error"></p>
    </form>
  `;

  const form = document.querySelector('#post-form');

  form.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  form.querySelector('#cancel').onclick = () => {
    document.querySelector('#editor-slot').replaceChildren();
  };

  form.onsubmit = async e => {
    e.preventDefault();

    const button = form.querySelector('[type=submit]');
    button.disabled = true;

    try {
      await api(
        '/api/admin/posts' + (p.id ? '/' + p.id : ''),
        {
          method: p.id ? 'PUT' : 'POST',
          body: JSON.stringify(
            Object.fromEntries(new FormData(form))
          )
        }
      );

      notice('Đã lưu bài viết');
      await postsTable();
    } catch (err) {
      form.querySelector('#form-error').textContent =
        err.message;

      button.disabled = false;
    }
  };
}

async function categoriesTable() {
  area().innerHTML = `
    <form id="new-category" class="compact-form">
      <input
        name="name"
        required
        minlength="2"
        maxlength="80"
        placeholder="Tên danh mục mới"
        aria-label="Tên danh mục mới"
      >
      <button class="btn">+ Thêm danh mục</button>
    </form>

    <p class="muted">
      Danh mục có bài viết không thể xóa;
      hãy chuyển các bài viết sang danh mục khác trước.
    </p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Danh mục</th>
            <th>Bài đã xuất bản</th>
            <th>Thao tác</th>
          </tr>
        </thead>

        <tbody>
          ${categories.map(c => `
            <tr>
              <td>${esc(c.name)}</td>
              <td>${c.post_count}</td>
              <td>
                <button
                  class="btn secondary"
                  data-rename="${c.id}"
                >
                  Đổi tên
                </button>

                <button
                  class="btn danger"
                  data-remove="${c.id}"
                >
                  Xóa
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  area().querySelector('#new-category').onsubmit = async e => {
    e.preventDefault();

    try {
      await api('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.target))
        )
      });

      notice('Đã thêm danh mục');
      await admin();
    } catch (err) {
      notice(err.message);
    }
  };

  area().querySelectorAll('[data-rename]').forEach(b => {
    b.onclick = async () => {
      const c = categories.find(
        c => c.id === Number(b.dataset.rename)
      );

      const name = prompt('Tên danh mục mới', c.name);

      if (!name) return;

      try {
        await api('/api/admin/categories/' + c.id, {
          method: 'PUT',
          body: JSON.stringify({ name })
        });

        await admin();
      } catch (e) {
        notice(e.message);
      }
    };
  });

  area().querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Xóa danh mục này?')) return;

      try {
        await api(
          '/api/admin/categories/' + b.dataset.remove,
          { method: 'DELETE' }
        );

        await admin();
      } catch (e) {
        notice(e.message);
      }
    };
  });
}

async function usersTable() {
  adminUsers = await api('/api/admin/users');

  area().innerHTML = `
    <button id="new-user" class="btn">
      + Thêm người dùng
    </button>

    <div id="user-slot"></div>

    <p class="muted">
      Biên tập viên chỉ sửa và xóa bài viết do mình tạo.
    </p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Người dùng</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Thao tác</th>
          </tr>
        </thead>

        <tbody>
          ${adminUsers.map(u => `
            <tr>
              <td>${esc(u.name)}</td>
              <td>${esc(u.email)}</td>
              <td>
                ${
                  u.role === 'admin'
                    ? 'Quản trị viên'
                    : 'Biên tập viên'
                }
              </td>

              <td>
                <button
                  class="btn secondary"
                  data-user-edit="${u.id}"
                >
                  Sửa
                </button>

                ${u.id !== currentUser.id ? `
                  <button
                    class="btn danger"
                    data-user-delete="${u.id}"
                  >
                    Xóa
                  </button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  area().querySelector('#new-user').onclick = () => {
    editUser();
  };

  area().querySelectorAll('[data-user-edit]').forEach(b => {
    b.onclick = () => {
      editUser(
        adminUsers.find(
          u => u.id === Number(b.dataset.userEdit)
        )
      );
    };
  });

  area().querySelectorAll('[data-user-delete]').forEach(b => {
    b.onclick = async () => {
      const confirmed = confirm(
        'Xóa tài khoản? Tài khoản đang có bài viết sẽ không thể xóa.'
      );

      if (!confirmed) return;

      try {
        await api(
          '/api/admin/users/' + b.dataset.userDelete,
          { method: 'DELETE' }
        );

        await usersTable();
      } catch (e) {
        notice(e.message);
      }
    };
  });
}

function editUser(u = {}) {
  document.querySelector('#user-slot').innerHTML = `
    <form id="user-form" class="editor">
      <h2>
        ${u.id ? 'Cập nhật tài khoản' : 'Thêm tài khoản'}
      </h2>

      <div class="row">
        <div>
          <label>
            Tên hiển thị
            <input
              name="name"
              value="${esc(u.name)}"
              required
              minlength="2"
              maxlength="100"
            >
          </label>
        </div>

        <div>
          <label>
            Email
            <input
              name="email"
              type="email"
              value="${esc(u.email)}"
              required
              ${u.id ? 'readonly' : ''}
              maxlength="190"
            >
          </label>
        </div>
      </div>

      <div class="row">
        <div>
          <label>
            Mật khẩu ${
              u.id ? 'mới (để trống nếu giữ nguyên)' : ''
            }
            <input
              name="password"
              type="password"
              ${u.id ? '' : 'required'}
              minlength="16"
              maxlength="128"
              autocomplete="new-password"
            >
          </label>
        </div>

        <div>
          <label>
            Vai trò
            <select name="role">
              <option
                value="editor"
                ${u.role !== 'admin' ? 'selected' : ''}
              >
                Biên tập viên
              </option>

              <option
                value="admin"
                ${u.role === 'admin' ? 'selected' : ''}
              >
                Quản trị viên
              </option>
            </select>
          </label>
        </div>
      </div>

      <div class="actions">
        <button class="btn">Lưu người dùng</button>

        <button
          class="btn secondary"
          type="button"
          id="cancel-user"
        >
          Hủy
        </button>
      </div>

      <p class="error" id="user-error"></p>
    </form>
  `;

  const form = document.querySelector('#user-form');

  form.querySelector('#cancel-user').onclick = () => {
    document.querySelector('#user-slot').replaceChildren();
  };

  form.onsubmit = async e => {
    e.preventDefault();

    const button = form.querySelector('button');
    button.disabled = true;

    try {
      await api(
        '/api/admin/users' + (u.id ? '/' + u.id : ''),
        {
          method: u.id ? 'PUT' : 'POST',
          body: JSON.stringify(
            Object.fromEntries(new FormData(form))
          )
        }
      );

      notice('Đã lưu tài khoản');

      if (u.id === currentUser.id) {
        await session();
        return admin();
      }

      await usersTable();
    } catch (err) {
      form.querySelector('#user-error').textContent =
        err.message;

      button.disabled = false;
    }
  };
}

function showError(e) {
  root.innerHTML = `
    <section class="empty">
      <h2>Chưa thể tải nội dung</h2>
      <p>${esc(e.message)}</p>
      <a class="btn" href="/">Thử lại</a>
    </section>
  `;
}

async function boot() {
  try {
    await session();
    categories = await api('/api/categories');

    if (location.pathname === '/quan-tri') {
      await admin();
    } else if (location.pathname.startsWith('/bai-viet/')) {
      await article();
    } else if (location.pathname === '/') {
      await home();
    } else {
      showError(Error('Trang này không tồn tại'));
    }
  } catch (e) {
    showError(e);
  }
}

window.addEventListener('popstate', boot);

boot();