# CERTLAB Practice App

Ứng dụng luyện thi nhiều chứng chỉ, được xây dựng bằng **React + Vite + TypeScript**. Người dùng chọn chứng chỉ, chọn đề thi thuộc chứng chỉ đó, sau đó làm bài và xem kết quả. Mỗi file JSON đại diện cho **một đề thi độc lập**.

## Chứng chỉ hiện có

| Chứng chỉ                                | Số đề hiện có | Số câu | File dữ liệu                                            |
| ---------------------------------------- | ------------: | -----: | ------------------------------------------------------- |
| Claude Certified Developer – Foundations |             1 |    155 | `public/data/claude-foundations-exam-01.json`           |
| Claude Certified Associate – Foundations |             1 |    193 | `public/data/claude-associate-foundations-exam-01.json` |

AWS SAA-C03 không còn nằm trong danh sách chứng chỉ của ứng dụng.

## Chạy local

Yêu cầu **Node.js 20.19+ hoặc 22.12+**.

```bash
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal (thường là `http://localhost:5173`). Không mở trực tiếp file HTML bằng trình duyệt vì ứng dụng tải dữ liệu JSON qua HTTP.

## Build production

```bash
npm run build
npm run preview
```

Bản build tĩnh được tạo tại `dist/`.

## Luồng sử dụng

1. **Chọn chứng chỉ**: chọn một chứng chỉ trong danh sách.
2. **Chọn đề thi**: chỉ hiển thị các đề thuộc chứng chỉ đã chọn.
3. **Tùy chọn bài thi**: cấu hình cách luyện tập trước khi bắt đầu.
4. **Làm bài**: trả lời câu hỏi, di chuyển qua Question Map và nộp bài.
5. **Xem kết quả**: xem điểm, số câu đúng/sai/bỏ qua và review từng câu.
6. **Retry Wrong**: tạo phiên mới chỉ gồm các câu đã trả lời sai; câu bỏ trống không được tính là câu sai.

## Tính năng

- Kiến trúc nhiều chứng chỉ; mỗi chứng chỉ có thể có một hoặc nhiều đề thi.
- Mỗi file JSON là một đề thi độc lập, được kiểm tra có từ **60 đến 200 câu hỏi** khi tải dữ liệu.
- Kiểm tra `certificationId` trong JSON phải khớp với chứng chỉ khai báo trong cấu hình ứng dụng.
- Hỗ trợ `single-select` và `multi-select`; câu trả lời chỉ đúng khi tập đáp án đã chọn khớp hoàn toàn với `correctAnswers`.
- Shuffle Questions: xáo trộn thứ tự câu hỏi cho mỗi phiên nếu bật.
- Exam Mode: ẩn đáp án đúng trong lúc làm bài và xáo trộn thứ tự phương án.
- Auto-Submit: tự động nộp bài khi hết thời gian nếu bật.
- Đồng hồ đếm ngược theo `settings.durationMinutes` của đề; mặc định 130 phút nếu không khai báo.
- Question Map, trạng thái câu hỏi, xác nhận đáp án trong Practice Mode và điều hướng giữa các câu.
- Trang kết quả hiển thị điểm số, số câu đúng/sai/bỏ qua và danh sách review.
- Retry Wrong: chỉ làm lại câu đã trả lời sai, reset câu trả lời của phiên retry và giữ dữ liệu đề gốc trong phiên trước khi bắt đầu retry.
- Lưu phiên đang làm và tùy chọn trong `localStorage`, hỗ trợ tiếp tục sau khi refresh cùng trình duyệt.
- Dark mode cơ bản và giao diện responsive.
- Nút Ask AI hiện là placeholder, chưa gọi dịch vụ AI.

## Cấu trúc dự án

```text
src/
  App.tsx       # Cấu hình chứng chỉ/đề thi, UI và logic phiên luyện thi
  main.tsx      # Entry point
  styles.css    # Giao diện responsive và dark mode
  types.ts      # Kiểu dữ liệu đề thi, câu hỏi và session
public/
  data/
    claude-foundations-exam-01.json
    claude-associate-foundations-exam-01.json
```

## Thêm chứng chỉ hoặc đề thi mới

Không cần viết lại luồng chọn đề, làm bài hay chấm điểm. Thực hiện hai bước:

### 1. Thêm file JSON

Đặt file đề thi vào `public/data/`, ví dụ:

```text
public/data/claude-foundations-exam-02.json
```

Mỗi file JSON phải có cấu trúc đề thi theo schema hiện tại:

```json
{
  "schemaVersion": "1.0",
  "id": "claude-foundations-exam-02",
  "certificationId": "claude-certified-developer-foundations",
  "title": "Practice Exam 02",
  "description": "Practice exam description.",
  "settings": {
    "durationMinutes": 130,
    "passingScorePercent": 72,
    "shuffleQuestions": false,
    "shuffleOptions": false,
    "allowReview": true,
    "showExplanationAfterAnswer": false
  },
  "questions": []
}
```

Đây là ví dụ khung; cần điền đầy đủ **60–200 câu hỏi** trước khi chạy ứng dụng.

Mỗi câu hỏi có các trường chính:

- `id`: ID duy nhất trong đề.
- `type`: `single-select` hoặc `multi-select`.
- `question`: nội dung câu hỏi.
- `options`: danh sách phương án `{ "id": "A", "text": "..." }`.
- `correctAnswers`: danh sách ID phương án đúng.
- `selectCount`: tùy chọn, dùng để thể hiện số phương án cần chọn cho câu multi-select.
- `metadata`: tùy chọn, gồm `domain`, `difficulty`, `tags`.

### 2. Đăng ký trong `CERTIFICATIONS` ở `src/App.tsx`

Thêm đề mới vào `exams` của chứng chỉ hiện có:

```tsx
{
  id: 'claude-certified-developer-foundations',
  title: 'Claude Certified Developer – Foundations',
  description: 'Claude development, API and developer workflows',
  exams: [
    {
      id: 'claude-foundations-exam-01',
      path: '/data/claude-foundations-exam-01.json',
    },
    {
      id: 'claude-foundations-exam-02',
      path: '/data/claude-foundations-exam-02.json',
    },
  ],
}
```

Để thêm chứng chỉ mới, thêm một object mới vào mảng `CERTIFICATIONS`, với `id`, `title`, `description` và danh sách `exams` tương ứng.

**Các giá trị phải khớp chính xác:**

- `exams[].path` phải trỏ tới file trong `public/`.
- `exams[].id` nên trùng với `id` trong file JSON.
- `certification.id` phải trùng với `certificationId` trong tất cả JSON thuộc chứng chỉ đó.

Ứng dụng hiện tải tất cả đề đã khai báo lúc khởi động. Nếu một file không tải được, JSON không hợp lệ, `certificationId` không khớp hoặc số câu nằm ngoài khoảng 60–200, quá trình tải dữ liệu sẽ báo lỗi.

## Cấu hình bài thi

Các cấu hình trong `settings` của JSON:

| Trường                | Ý nghĩa            | Giá trị mặc định trong ứng dụng |
| --------------------- | ------------------ | ------------------------------- |
| `durationMinutes`     | Thời lượng bài thi | `130` phút                      |
| `passingScorePercent` | Phần trăm điểm đạt | `72`                            |

Các tùy chọn do người dùng điều khiển và lưu trong trình duyệt:

| Tùy chọn           | Ý nghĩa                                       |
| ------------------ | --------------------------------------------- |
| `shuffleQuestions` | Xáo trộn câu hỏi mỗi phiên                    |
| `autoSubmit`       | Tự nộp bài khi hết giờ                        |
| `examMode`         | Ẩn đáp án trong khi làm và xáo trộn phương án |

## Lưu ý dữ liệu và vận hành

- `correctAnswers` phải tham chiếu tới các `options[].id` tồn tại. Với `single-select`, cần đúng một đáp án; với `multi-select`, cần khai báo đầy đủ các đáp án đúng.
- Câu multi-select được chấm đúng khi chọn chính xác toàn bộ đáp án, không thiếu và không thừa.
- Câu bỏ trống được thống kê riêng, không đưa vào danh sách Retry Wrong.
- Các câu có metadata tag `needs-review` vẫn có thể được luyện tập; nên rà soát nội dung và đáp án trước khi dùng làm tài liệu đánh giá chính thức.
- Tiến độ và tùy chọn được lưu trong `localStorage` của trình duyệt hiện tại; chưa đồng bộ giữa thiết bị, trình duyệt hoặc người dùng và chưa có backend/tài khoản.
- Phiên đang làm được lưu để tiếp tục sau refresh. Xóa dữ liệu site/localStorage sẽ xóa tiến độ đã lưu.
- Khi thay đổi schema hoặc cấu trúc session, cần xem xét nâng version các khóa localStorage (`certlab-practice-session-v2`, `certlab-practice-session-context-v2`, `certlab-practice-settings-v2`) và xử lý dữ liệu phiên cũ.
- Nút **Ask AI** hiện chỉ hiển thị thông báo placeholder. Khi tích hợp AI thật, không đặt API key trong frontend; cần backend/API proxy và cơ chế xác thực, giới hạn sử dụng.

## Kiểm tra trước khi phát hành

```bash
npm run build
```

Nên kiểm tra thủ công tối thiểu:

- Mỗi chứng chỉ hiển thị đúng các đề đã đăng ký.
- Có thể chuyển giữa các chứng chỉ và đề thi.
- Đề có 60 câu và 200 câu được tải; đề ngoài giới hạn bị từ chối.
- `certificationId` sai hoặc file JSON lỗi được báo rõ.
- Câu single-select, multi-select, câu bỏ trống và câu có `needs-review` hoạt động đúng.
- Retry Wrong chỉ chứa câu đã trả lời sai và không làm thay đổi kết quả bài thi gốc.
- Refresh khi đang làm bài có thể khôi phục phiên.
