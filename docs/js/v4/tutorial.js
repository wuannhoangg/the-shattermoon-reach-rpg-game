/* Beginner guide: paged, used on the title screen, in the game and inside a battle. */
(function (g) {
  'use strict';
  const PAGES = [
    {t: 'Mục tiêu và cách chơi', h: `
      <p>Bạn là một người bị triệu hồi từ thế giới khác tới Vực Tàn Nguyệt. Bạn có một năng lực hiếm: lập <b>Khế Hồn</b> với những sinh linh đã mất trái tim và trả lại trái tim cho chúng.</p>
      <ul>
        <li><b>Đi theo nhiệm vụ.</b> Thẻ nhiệm vụ ở góc màn hình luôn nói bước tiếp theo. Bấm nút <b>Hành trình</b> (phím <kbd>J</kbd>) để xem đầy đủ và để nhân vật tự tìm đường tới nơi cần đến.</li>
        <li><b>Thu phục khế thú</b> để lập đội. Khế thú ra trận cùng bạn.</li>
        <li><b>Hạ trùm vùng</b> để lấy Mảnh Trăng và mở vùng mới.</li>
        <li><b>Trò chơi tự động lưu</b>. Bạn cũng có thể lưu thủ công trong mục <b>Lưu / Tải</b>.</li>
      </ul>`},
    {t: 'Di chuyển và tương tác', h: `
      <ul>
        <li><b>Đi bộ:</b> phím <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, hoặc chạm/bấm vào mặt đất để nhân vật tự đi tới đó.</li>
        <li><b>Tương tác</b> với người, cổng, đền, rương: đứng gần và bấm <kbd>E</kbd> (hoặc bấm thẳng vào họ).</li>
        <li><b>Địa đồ</b> (<kbd>M</kbd>): chọn một nơi để nhân vật tự đi tới, kể cả sang bản đồ khác.</li>
        <li><b>Đền Lửa</b> hồi đầy HP và MP, thắp lại một Nến Hồn và là nơi bạn trở về khi gục ngã.</li>
        <li><b>Phím tắt:</b> <kbd>J</kbd> Hành trình · <kbd>B</kbd> Bách Quái Lục · <kbd>P</kbd> Đội hình · <kbd>C</kbd> Nhân vật · <kbd>I</kbd> Hành trang · <kbd>R</kbd> Vạn Tộc Chí. <kbd>Esc</kbd> quay lại một bước.</li>
      </ul>
      <p class="small">Trên điện thoại: chạm để đi, dùng thanh nút phía trên để mở các mục trên.</p>`},
    {t: 'Gặp quái và thu phục', h: `
      <ul>
        <li><b>Chỉ gặp quái trong vùng sinh sống</b> của chúng (cỏ, rừng, nước… được tô màu trên bản đồ). Đi trên đường thì an toàn.</li>
        <li><b>Thẻ KHU SĂN</b> (dưới thẻ nhiệm vụ) liệt kê loài trong vùng và tỉ lệ gặp. Chọn một loài rồi bấm nút tự tìm để nhân vật tự đi săn cho tới khi bạn bấm dừng.</li>
        <li><b>Thu phục:</b> chỉ với quái hoang dã. Trong trận chọn <b>Khế Hồn</b>, chọn loại phong ấn, mỗi loại hiện sẵn tỉ lệ thành công.</li>
        <li><b>Tỉ lệ cao hơn khi:</b> quái còn ít máu, phong ấn hợp hệ, đã tìm ra điểm yếu, nhân vật có thiên phú Khế Hồn cao.</li>
        <li><b>Quái mất tim</b> có mắt vô hồn. Thu phục sẽ trả lại trái tim cho chúng. Một số Bá Chủ cần vật phẩm đặc biệt.</li>
        <li>Đội tối đa 5 khế thú, số thừa vào <b>kho</b>.</li>
      </ul>`},
    {t: 'Chiến đấu: lượt và đội hình', h: `
      <p>Góc trên có <b>Vòng</b> và dải kim cương cho biết thứ tự ra đòn (SPD càng cao càng đi sớm). Dưới trái là các thẻ <b>đội hình</b>: nhân vật và khế thú đang ở trên sân, kèm HP và MP.</p>
      <ul>
        <li><b>Đấu một đối thủ</b> (một quái hoang dã, một trùm): mỗi vòng bạn chọn <b>một</b> hành động, của nhân vật <b>hoặc</b> của một khế thú. Bấm thẻ đội hình để đổi người sẽ ra đòn. Sau đó đối thủ đánh.</li>
        <li><b>Đấu từ hai đối thủ trở lên, hoặc đấu với một người:</b> mỗi vòng <b>cả đội</b> của bạn đều được hành động, mỗi người một lần. Bấm thẻ để chọn ai đi trước. Khi đội đã đi hết, cả bên đối thủ ra đòn.</li>
        <li>Nhân vật gục thì thua trận. Khế thú gục thì khế thú dự bị tự bước lên thay.</li>
        <li>MP của nhân vật và khế thú trên sân tự hồi dần sau mỗi vòng.</li>
        <li>Trạng thái như Choáng, Đóng Băng, Tê Liệt có thể khiến một người mất lượt. Trạng thái hiện trên thẻ, và nhật ký trận ghi rõ ai bị mất lượt.</li>
      </ul>`},
    {t: 'Chiến đấu: các lệnh', h: `
      <ul>
        <li><b>Tấn công:</b> mở tab Kỹ năng. Chọn <b>mục tiêu</b> ở hàng trên, rồi chọn một trong bốn kỹ năng hoặc <b>Đòn thường</b> (không tốn MP). Đang ở tab Kỹ năng mà bấm sang thẻ khác thì tab vẫn mở, bạn chỉ việc chọn kỹ năng cho người đó.</li>
        <li><b>Hệ khắc nhau:</b> thẻ kỹ năng ghi <i>Hiệu quả ×2</i> (khắc), <i>Bình thường ×1</i> hoặc <i>Tác dụng yếu ×0.5</i>. Chọn kỹ năng khắc hệ của đối thủ sẽ gây sát thương gấp đôi.</li>
        <li><b>Khế Hồn:</b> thu phục quái hoang dã (chỉ nhân vật dùng được). Nút <b>Nói chuyện</b> thử làm quái dịu lại (hiệu quả khi đã lộ điểm yếu).</li>
        <li><b>Vật phẩm:</b> hồi HP, hồi MP, giải trạng thái. Bấm nút <b>i</b> bên cạnh mỗi vật phẩm để xem tác dụng chi tiết trước khi dùng. Dùng vật phẩm tốn lượt của nhân vật.</li>
        <li><b>Đổi vị trí:</b> đưa khế thú dự bị lên sân.</li>
        <li><b>Phòng thủ:</b> giảm mạnh sát thương nhận vào trong vòng này.</li>
        <li><b>Thêm:</b> <i>Quan sát</i> ghi lại điểm yếu; <i>Khắc chế</i> khai thác điểm yếu đó (tốn một bộ khảo sát); <i>Bỏ chạy</i>.</li>
        <li><b>Tự đánh</b> (với quái hoang dã yếu) và nút <b>Nhanh ×1 / ×2</b> giúp trận đánh gọn hơn. Bảng <b>Cài đặt</b> trong trận có nút thoát về menu chính.</li>
      </ul>`},
    {t: 'Thắng, thua và bỏ chạy', h: `
      <ul>
        <li><b>Thắng:</b> nhận kinh nghiệm cho nhân vật và khế thú trên sân (khế thú dự bị nhận một nửa), tro vàng, chiến lợi phẩm, đôi khi có thức ăn tăng kinh nghiệm.</li>
        <li><b>Thua</b> (nhân vật gục): bạn <b>mất một Nến Hồn</b> (lúc đầu có 5), rồi tỉnh dậy ở Đền Lửa gần nhất với HP và MP đầy. Khi hết Nến Hồn, bạn mất thêm 25% tro vàng và một ký ức. Ở chế độ Khắc Nghiệt, hết Nến Hồn là mất cả hành trình.</li>
        <li><b>Bỏ chạy:</b> chỉ được với quái hoang dã và kẻ chặn đường, tỉ lệ phụ thuộc SPD của bạn. Trùm và đấu với người thì không bỏ chạy được.</li>
        <li>Thắp lại Nến Hồn ở Đền Lửa hoặc dùng vật phẩm Nến Hồn.</li>
        <li>Khế thú gục nhiều lần mà bạn không chăm sóc có thể rời đội.</li>
      </ul>`},
    {t: 'Đội hình và khế thú', h: `
      <ul>
        <li><b>Đội hình</b> (<kbd>P</kbd>): xếp thứ tự. Hai khế thú đầu ra sân khi đấu quái hoang; đấu với người thì số khế thú ra sân bằng số khế thú của họ.</li>
        <li>Bấm <b>Quản lý</b> trên mỗi khế thú để xem cấp, kinh nghiệm, chỉ số, tính cách, gắn kết, <b>bốn kỹ năng đang mang</b> và những kỹ năng sắp học.</li>
        <li><b>Nuôi dưỡng:</b> cho ăn thức ăn hoặc vật phẩm kinh nghiệm để tăng cấp; thức ăn còn tăng gắn kết. Gắn kết cao giúp khế thú nghe lệnh và mở tiến hóa.</li>
        <li><b>Tiến hóa:</b> khi đủ điều kiện (cấp, gắn kết, nguyên liệu…), nút Tiến hóa sẽ sáng lên.</li>
        <li><b>Bộ kỹ năng:</b> mỗi người mang tối đa 4 kỹ năng chủ động. Đổi bộ này ngoài trận, không đổi được trong giao tranh.</li>
        <li><b>Bách Quái Lục</b> (<kbd>B</kbd>) ghi mọi loài đã gặp và đã thu phục, kèm điểm yếu đã khám phá.</li>
      </ul>`},
    {t: 'Nhân vật, hành trang và trang bị', h: `
      <ul>
        <li><b>Nhân vật</b> (<kbd>C</kbd>): khi lên cấp bạn có điểm chỉ số (bấm +1 vào chỉ số muốn tăng) và điểm kỹ năng để học kỹ năng mới của lớp.</li>
        <li><b>Hành trang</b> (<kbd>I</kbd>): dùng vật phẩm hồi phục, thức ăn, nến. Bấm một vật phẩm để xem chi tiết.</li>
        <li><b>Bảo Vật Chí:</b> thư viện mọi vật phẩm và trang bị, ghi tác dụng và nơi tìm. Với trang bị bạn có, mở trang chi tiết để <b>mặc</b>, <b>rèn +1</b> (tốn tro vàng) hoặc <b>khảm ngọc</b> tăng phòng thủ.</li>
        <li><b>Cửa hàng</b> bán phong ấn thu phục và thuốc. Tro vàng kiếm được từ trận thắng và nhiệm vụ.</li>
        <li>Trang bị bị nguyền sẽ rút máu, hãy giải nguyền trước khi thay.</li>
      </ul>`},
    {t: 'Khám phá, lưu và thoát', h: `
      <ul>
        <li><b>Hành trình</b> (<kbd>J</kbd>): nhiệm vụ, manh mối, lộ trình. <b>Vạn Tộc Chí</b> (<kbd>R</kbd>): các chủng tộc. <b>Album Khế Hồn:</b> bộ sưu tập các dạng quái bạn đã có.</li>
        <li><b>Lưu / Tải:</b> có ô tự động và ba ô thủ công.</li>
        <li><b>Cài đặt:</b> nhạc và âm thanh, tốc độ trận, độ khó, bố cục hiển thị trên điện thoại.</li>
        <li><b>Thoát:</b> nút <b>Thoát</b> ở thanh phía trên đưa bạn về menu chính. Tiến trình đã được tự lưu. Bạn có thể quay lại bằng <b>Tiếp tục</b>.</li>
        <li>Bạn có thể mở lại hướng dẫn này bất cứ lúc nào bằng nút <b>Hướng dẫn</b> ở thanh phía trên, hoặc nút <b>?</b> trong trận.</li>
      </ul>`},
  ];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, k => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[k]));
  function inner(i) {
    const n = Math.max(0, Math.min(PAGES.length - 1, i)), p = PAGES[n];
    const steps = PAGES.map((x, k) => `<button type="button" class="${k === n ? 'is-active' : ''}" data-tut-go="${k}" title="${esc(x.t)}">${k + 1}</button>`).join('');
    return `<div class="tut-steps" role="tablist" aria-label="Các trang hướng dẫn">${steps}</div><article class="tut-page"><small>Trang ${n + 1} / ${PAGES.length}</small><h2>${esc(p.t)}</h2>${p.h}</article><div class="tut-actions"><button type="button" class="vtn-button secondary" data-tut-go="${n - 1}" ${n === 0 ? 'disabled' : ''}>← Trước</button><button type="button" class="vtn-button" data-tut-go="${n + 1}" ${n === PAGES.length - 1 ? 'disabled' : ''}>Tiếp →</button></div>`;
  }
  function html(page = 0) { return `<div class="tutorial" data-tut-page="${page}">${inner(page)}</div>`; }
  /* The two battle pages as a compact block for the in-battle help panel. */
  function battleHtml() {
    return `<div class="tutorial tut-battle">${PAGES[3].h}${PAGES[4].h}${PAGES[5].h}</div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-tut-go]');
    if (!b || b.disabled) return;
    const root = b.closest('.tutorial');
    if (!root) return;
    e.stopPropagation();
    const i = Number(b.dataset.tutGo);
    if (!Number.isFinite(i)) return;
    root.dataset.tutPage = String(i);
    root.innerHTML = inner(i);
    root.scrollIntoView?.({block: 'nearest'});
  }, true);
  g.VTNTutorial = {html, battleHtml, pages: PAGES.length};
})(window);
