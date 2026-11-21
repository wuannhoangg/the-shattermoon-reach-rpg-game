/* Shared settings form (title menu panel + in-game screen). Every control applies immediately and is saved in VTNPrefs. */
(function (g) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const opt = (value, label, cur) => `<option value="${esc(value)}" ${String(cur) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
  const row = (label, control, hint = '') => `<div class="set-row"><label><span class="set-label">${label}</span>${control}</label>${hint ? `<small class="set-hint">${hint}</small>` : ''}</div>`;
  const check = (key, label, checked, hint = '') => `<div class="set-row"><label class="set-check"><input type="checkbox" data-pref="${key}" ${checked ? 'checked' : ''}><span class="set-label">${label}</span></label>${hint ? `<small class="set-hint">${hint}</small>` : ''}</div>`;
  const range = (key, value) => `<input type="range" data-pref="${key}" min="0" max="1" step=".05" value="${value}">`;

  function markup() {
    const p = g.VTNPrefs.get(), diffs = g.VTNPrefs.DIFFICULTY, tracks = g.VTNAudio ? g.VTNAudio.TRACKS : [];
    return `<div class="settings-form">
      <section class="set-group"><h3>Âm thanh</h3>
        ${check('musicOn', 'Bật nhạc nền', p.musicOn)}
        ${row('Bài nhạc', `<select data-pref="musicTrack">${opt('auto', 'Tự động theo cảnh', p.musicTrack)}${tracks.map(t => opt(t.id, t.name, p.musicTrack)).join('')}</select>`, 'Mỗi bài luôn được phát trọn vẹn. Cảnh mới chỉ quyết định bài kế tiếp; chọn một bài cụ thể ở đây để nghe lặp lại bài đó.')}
        ${row('Âm lượng nhạc', range('musicVolume', p.musicVolume))}
        ${check('sfxOn', 'Bật hiệu ứng âm thanh', p.sfxOn)}
        ${row('Âm lượng hiệu ứng', range('sfxVolume', p.sfxVolume))}
      </section>
      <section class="set-group"><h3>Độ khó</h3>
        <div class="set-diff" role="radiogroup" aria-label="Độ khó">${Object.entries(diffs).map(([id, d]) => `<div class="set-diff-card ${p.difficulty === id ? 'is-on' : ''}"><label><input type="radio" name="difficulty" data-pref="difficulty" value="${id}" ${p.difficulty === id ? 'checked' : ''}><strong>${esc(d.name)}</strong><small>${esc(d.note)}</small></label><details class="difficulty-info" onkeydown="if(event.target.tagName==='SUMMARY' &amp;&amp; (event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();this.open=!this.open;}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.open=false;this.querySelector('summary').focus();}"><summary role="button" aria-label="Xem chi tiết độ khó ${esc(d.name)}">ⓘ</summary><div class="difficulty-rules" role="region" aria-label="Quy tắc ${esc(d.name)}"><p>${esc(d.summary)}</p><ul>${d.rules.map(rule => `<li>${esc(rule)}</li>`).join('')}</ul></div></details></div>`).join('')}</div>
      </section>
      <section class="set-group"><h3>Trận đấu</h3>
        ${row('Tốc độ trận', `<select data-pref="battleSpeed" data-num="1">${[1, 2, 3].map(v => opt(v, 'Nhịp ' + v + (v === 1 ? ' · chậm, dễ theo dõi' : v === 3 ? ' · rất nhanh' : ''), p.battleSpeed)).join('')}</select>`)}
        ${row('Hiệu ứng kỹ năng', `<select data-pref="vfx">${opt('full', 'Đầy đủ', p.vfx)}${opt('light', 'Nhẹ (ít hạt, không loé sáng)', p.vfx)}${opt('off', 'Tắt', p.vfx)}</select>`)}
        ${check('shake', 'Rung màn hình khi trúng đòn mạnh', p.shake)}
        ${check('numbers', 'Hiện số sát thương nổi', p.numbers)}
      </section>
      <section class="set-group"><h3>Khám phá và giao diện</h3>
        ${row('Tầm nhìn (độ cao camera)', `<select data-pref="viewRange">${opt('near', 'Gần', p.viewRange)}${opt('mid', 'Vừa', p.viewRange)}${opt('far', 'Xa', p.viewRange)}${opt('vfar', 'Rất xa', p.viewRange)}${opt('ultra', 'Siêu xa', p.viewRange)}${opt('whole', 'Toàn cảnh (cả vùng một khung hình)', p.viewRange)}</select>`)}
        ${row('Tốc độ tự tìm đường', `<select data-pref="pathSpeed">${opt('slow', 'Chậm', p.pathSpeed)}${opt('normal', 'Vừa', p.pathSpeed)}${opt('fast', 'Nhanh (bằng đi bộ)', p.pathSpeed)}${opt('rapid', 'Rất nhanh (x1,7)', p.pathSpeed)}${opt('turbo', 'Siêu nhanh (x2,6)', p.pathSpeed)}${opt('blitz', 'Tức tốc (x4)', p.pathSpeed)}</select>`)}
        ${row('Tốc độ chữ hội thoại', `<select data-pref="textSpeed" data-num="1">${[1, 2, 3].map(v => opt(v, 'Nhịp ' + v, p.textSpeed)).join('')}</select>`)}
        ${row('Bố cục hiển thị', `<select data-pref="layout">${opt('auto', 'Tự động theo màn hình', p.layout)}${opt('desktop', 'Máy tính · bố cục rộng', p.layout)}${opt('phone', 'Điện thoại · bố cục gọn', p.layout)}</select>`, 'Áp dụng trên điện thoại và máy tính bảng. Trên máy tính, bố cục tự đổi theo kích thước cửa sổ trình duyệt.')}${row('Chuyển động nền menu', `<select data-pref="motion">${opt('full', 'Đầy đủ', p.motion)}${opt('reduced', 'Giảm chuyển động', p.motion)}</select>`)}
      </section>
    </div>`;
  }

  function bind(root) {
    root.querySelectorAll('[data-pref]').forEach(el => {
      const key = el.dataset.pref;
      const read = () => el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.dataset.num ? Number(el.value) : el.value;
      el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
        g.VTNPrefs.set({[key]: read()});
        if (key === 'difficulty') root.querySelectorAll('.set-diff-card').forEach(c => c.classList.toggle('is-on', c.querySelector('input').checked));
        if (key === 'motion' && g.VTNGame?.refreshMotion) g.VTNGame.refreshMotion();
      });
    });
  }
  g.VTNSettingsUI = {markup, bind};
})(window);
