import React from 'react';

export const GuideTab: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-slate-200 pb-4">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Hướng dẫn sử dụng
          </h2>
          <p className="mt-2 text-slate-600">
            Ứng dụng vẽ miền nghiệm của hệ bất phương trình bậc nhất hai ẩn và sinh mã TikZ tương ứng.
            Hình ở tab <strong>Hình xem trước</strong> và mã ở tab <strong>Mã TikZ</strong> cùng lấy từ một dữ liệu nên luôn khớp nhau;
            bấm <strong>F1</strong> bất cứ lúc nào để mở trang này.
          </p>
          <nav aria-label="Mục lục hướng dẫn" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-sky-700">
            <a href="#hd-nhanh" className="hover:underline">1. Bắt đầu nhanh</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-nhap" className="hover:underline">2. Nhập bất phương trình</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-khung" className="hover:underline">3. Khung nhìn và trục</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-thongso" className="hover:underline">4. Thông số từng hàm</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-bading" className="hover:underline">5. Nhập hàm bằng 3 điểm</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-chuot" className="hover:underline">6. Tương tác bằng chuột</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-bat" className="hover:underline">7. Bắt điểm</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-diem" className="hover:underline">8. Điểm đánh dấu A, B, C…</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-nut" className="hover:underline">9. Nút lệnh và phím tắt</a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a href="#hd-tikz" className="hover:underline">10. Dùng mã TikZ</a>
          </nav>
        </header>

        <section id="hd-nhanh" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">1. Bắt đầu nhanh</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Gõ bất phương trình vào ô <strong>Hàm 1</strong>, ví dụ <code>2x+3y&lt;6</code>. Bấm <strong>＋ Thêm hàm</strong> để thêm hàm khác.
            </li>
            <li>
              Xem hình ở tab <strong>Hình xem trước</strong>: phần được gạch sọc (hoặc tô màu) là phần <em>không</em> thỏa bất phương trình, phần để trống là <strong>miền nghiệm</strong>.
            </li>
            <li>Chỉnh khung nhìn, màu, kiểu gạch sọc hoặc tô màu nếu cần.</li>
            <li>Bấm <strong>Thực hiện</strong> hoặc <strong>Sao chép TikZ</strong> để chép mã TikZ vào clipboard.</li>
          </ol>
        </section>

        <section id="hd-nhap" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">2. Nhập bất phương trình</h3>
          <p>
            Mỗi ô có <strong>đúng một</strong> dấu <code>&lt;</code> hoặc <code>&gt;</code>. Được dùng <code>x</code>, <code>y</code> (hoa hay thường đều được),
            số (có thể thập phân), phép <code>+ - * /</code>, dấu ngoặc, và viết liền hệ số như <code>2x</code>. Hai vế có thể chứa cả x và y.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Ví dụ</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Ý nghĩa</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">2x+3y&lt;6</td>
                  <td className="border border-slate-200 px-3 py-1.5">Dạng thường gặp</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">y/2 &gt; x-3</td>
                  <td className="border border-slate-200 px-3 py-1.5">Có phân số, x và y ở cả hai vế</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">(x+1)*2 &lt; y</td>
                  <td className="border border-slate-200 px-3 py-1.5">Có ngoặc và dấu nhân</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">x&lt;3, y&gt;-2</td>
                  <td className="border border-slate-200 px-3 py-1.5">Đường biên thẳng đứng / nằm ngang</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600">
            Với dấu ≤ hoặc ≥ vẫn gõ &lt; hoặc &gt;; ô nhập viền đỏ khi biểu thức không hợp lệ và hiện thông báo lý do ngay bên dưới.
          </p>
        </section>

        <section id="hd-khung" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">3. Khung nhìn và trục</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>X min, X max, Y min, Y max</strong>: cần X min &lt; 0 &lt; X max và Y min &lt; 0 &lt; Y max. Hỗ trợ số rất lớn hoặc rất nhỏ (vd: <code>200000</code> hoặc <code>1e-3</code>).</li>
            <li><strong>Tự chia vạch trên hai trục</strong>: tự động chọn bước chia đẹp dạng 1, 2, 5 × 10^k; tắt để nhập tay Bước X, Bước Y.</li>
            <li><strong>Tự chọn khung nhìn theo các hàm</strong>: đặt khung vừa đủ chứa các giao điểm với trục và giao điểm giữa các đường biên.</li>
            <li><strong>Hiện số trên trục</strong> và <strong>Hiện gạch trên trục</strong> bật tắt độc lập.</li>
          </ul>
        </section>

        <section id="hd-thongso" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">4. Thông số từng hàm</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Màu</strong> của đường biên, gạch sọc hoặc vùng tô.</li>
            <li><strong>Kiểu</strong>: <em>Gạch sọc</em> (chỉnh góc 0–179° hoặc Tự động = quay thêm 60°, khoảng cách 0,5–30 pt) hoặc <em>Tô màu</em> (độ đậm 5–100%).</li>
            <li><strong>Hiện nhãn trên đường</strong> và <strong>Vị trí nhãn</strong>: 0% là đầu bên trái (đầu dưới nếu thẳng đứng), 100% là đầu bên phải (đầu trên).</li>
          </ul>
        </section>

        <section id="hd-bading" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">5. Nhập hàm bằng 3 điểm</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Bấm <strong>Chọn 3 điểm</strong> ở hàng muốn nhập rồi click trên hình xem trước.</li>
            <li>Click điểm thứ nhất và điểm thứ hai trên đường biên.</li>
            <li>Click điểm thứ ba thuộc miền nghiệm (miền để trống). Bất phương trình được suy ra tối giản và điền vào ô nhập.</li>
          </ol>
          <p className="text-xs text-slate-600">
            Click gần vòng tròn cam (giao điểm của hai đường biên khác) để lấy đúng tọa độ giao điểm đó. Chuột phải lùi một bước; Esc hoặc nút Hủy chọn hủy thao tác.
          </p>
        </section>

        <section id="hd-chuot" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">6. Tương tác bằng chuột</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Không kéo</strong>: chỉ xem hình.</li>
            <li><strong>Kéo đường</strong>: giữ chuột trên một đường biên rồi kéo để tịnh tiến song song.</li>
            <li><strong>Kéo giao điểm</strong>: kéo một giao điểm, mọi đường đi qua điểm đó cùng tịnh tiến theo.</li>
            <li><strong>Thêm / xóa điểm</strong>: bấm vào giao điểm hoặc một đường để đánh dấu điểm A, B, C…; bấm vào điểm đã đánh dấu hoặc chuột phải để xóa. Mỗi đường tối đa 2 điểm.</li>
            <li><strong>Kéo điểm</strong>: kéo một điểm đã đánh dấu; các đường gắn với điểm xoay quanh điểm còn lại hoặc tịnh tiến nếu chỉ có 1 điểm.</li>
          </ul>
        </section>

        <section id="hd-bat" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">7. Bắt điểm</h3>
          <p>
            <strong>Vạch chia</strong> (nguyên lưới), <strong>Nửa vạch chia</strong> (0.5 bước), hoặc <strong>Tự do</strong>. Áp dụng khi chọn 3 điểm, thêm điểm lên đường và thả chuột sau lúc kéo. Bật <strong>Bắt giao điểm</strong> để bắt chính xác giao điểm khi chọn 3 điểm.
          </p>
        </section>

        <section id="hd-diem" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">8. Điểm đánh dấu A, B, C…</h3>
          <p>
            Giao điểm các đường biên không tự vẽ. Dùng chế độ <strong>Thêm / xóa điểm</strong> để đánh dấu các điểm cần hiển thị; tên A, B, C… tự động tránh trùng đường và xuất hiện cả trên hình xem trước lẫn mã TikZ.
          </p>
        </section>

        <section id="hd-nut" className="space-y-2">
          <h3 className="font-display text-base font-semibold text-slate-900">9. Nút lệnh và phím tắt</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Nút</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Tác dụng</th>
                  <th className="border border-slate-200 px-3 py-2 font-semibold">Phím tắt</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-medium">Thực hiện</td>
                  <td className="border border-slate-200 px-3 py-1.5">Tính lại, sao chép mã TikZ và chuyển sang tab Mã TikZ</td>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">Ctrl+Enter</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-medium">Sao chép TikZ</td>
                  <td className="border border-slate-200 px-3 py-1.5">Sao chép mã TikZ đang hiển thị vào clipboard</td>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">Ctrl+Shift+C</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-medium">Hoàn tác / Làm lại</td>
                  <td className="border border-slate-200 px-3 py-1.5">Lùi / tiến tối đa 60 thao tác</td>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">Ctrl+Z / Ctrl+Y</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-medium">Lưu dự án / Mở dự án</td>
                  <td className="border border-slate-200 px-3 py-1.5">Xuất / nhập tệp .json tương thích hoàn toàn với bản desktop</td>
                  <td className="border border-slate-200 px-3 py-1.5 font-mono">Ctrl+S / Ctrl+O</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-medium">Mặc định</td>
                  <td className="border border-slate-200 px-3 py-1.5">Đưa khung nhìn về −5…5 và tạo 3 hàng trống</td>
                  <td className="border border-slate-200 px-3 py-1.5">—</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-1.5 font-medium">Xuất ảnh PNG</td>
                  <td className="border border-slate-200 px-3 py-1.5">Tải về ảnh PNG độ phân giải cao của hình xem trước</td>
                  <td className="border border-slate-200 px-3 py-1.5">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="hd-tikz" className="space-y-2 pb-4">
          <h3 className="font-display text-base font-semibold text-slate-900">10. Dùng mã TikZ</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Hàm dùng <em>gạch sọc</em> cần <code>\usetikzlibrary&#123;patterns.meta&#125;</code> trong phần khai báo LaTeX.</li>
            <li>Hàm <em>tô màu</em> dùng <code>fill opacity</code>, biên dịch trực tiếp với pdfLaTeX, XeLaTeX, LuaLaTeX.</li>
            <li>Số lẻ lấy tối đa 2 chữ số thập phân; nhãn có số lẻ được viết dạng phân số <code>\frac&#123;p&#125;&#123;q&#125;</code>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
