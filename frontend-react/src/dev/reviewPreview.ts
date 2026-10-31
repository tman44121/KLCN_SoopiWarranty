// Local preview only; Vite excludes this module from production builds.
const comments: [number, string][] = [
  [5, 'Nhân viên tiếp nhận hướng dẫn rõ ràng, máy được kiểm tra cẩn thận. Tôi nhận lại thiết bị đúng lịch hẹn.'],
  [4, 'Báo giá chi tiết từng linh kiện. Tôi có thể xem trước và xác nhận trên web nên khá thuận tiện.'],
  [5, 'Kỹ thuật viên giải thích dễ hiểu, chủ động nhắn tin khi có kết quả kiểm tra. Rất hài lòng với cách hỗ trợ.'],
  [3, 'Thiết bị đã hoạt động tốt nhưng thời gian chờ linh kiện lâu hơn dự kiến. Mong trung tâm cập nhật lịch hẹn sớm hơn.'],
  [5, 'Tra cứu bằng mã phiếu nhanh, không cần gọi điện hỏi tình trạng máy nhiều lần.'],
  [4, 'Trung tâm đóng gói máy cẩn thận khi bàn giao. Các hạng mục sửa chữa đều được ghi lại rõ ràng.'],
  [5, 'Tôi gửi yêu cầu trước khi đến trạm nên khâu tiếp nhận diễn ra rất nhanh. Nhân viên thân thiện.'],
  [4, 'Máy chạy ổn định sau khi thay linh kiện. Kỹ thuật viên có hướng dẫn cách sử dụng để hạn chế lỗi lặp lại.'],
  [2, 'Tôi phải chờ khá lâu mới nhận được lịch trả máy. Phần trao đổi về thời gian cần cải thiện, dù máy đã sửa được.'],
  [5, 'Có thể nhắn trực tiếp với người phụ trách nên tôi yên tâm hơn. Các câu hỏi đều được trả lời rõ ràng.'],
  [4, 'Lần đầu sử dụng dịch vụ, thao tác đăng ký và tra cứu dễ hiểu. Muốn phần thông báo cập nhật thường xuyên hơn.'],
  [5, 'Chi phí thực tế đúng với báo giá đã duyệt. Không phát sinh khoản thu ngoài dự kiến.'],
  [3, 'Nhân viên hỗ trợ lịch sự. Máy đã hoạt động lại nhưng tôi phải mang đến kiểm tra lần thứ hai.'],
  [5, 'Tình trạng thiết bị được ghi nhận đầy đủ từ lúc tiếp nhận đến khi trả máy. Cách làm việc rõ ràng.'],
  [4, 'Trạm dễ tìm, nhân viên kiểm tra máy cùng khách trước khi bàn giao. Tôi khá hài lòng.'],
  [5, 'Tôi thích việc xem được lịch sử sửa chữa và linh kiện đã thay ngay trên tài khoản.'],
  [4, 'Kỹ thuật viên tư vấn phương án sửa phù hợp với tình trạng máy và giải thích rõ phần còn bảo hành.'],
  [5, 'Nhận máy xong tôi được hướng dẫn kiểm tra lại các chức năng. Mọi thứ hoạt động bình thường.'],
  [1, 'Trải nghiệm lần này chưa tốt vì lịch hẹn bị thay đổi nhiều lần. Tôi mong nhận được thông báo chủ động hơn.'],
  [4, 'Giao diện dễ theo dõi trên điện thoại, nội dung báo giá không bị khó đọc.'],
  [5, 'Từ lúc gửi yêu cầu đến khi nhận lại máy đều có thông tin để theo dõi. Dịch vụ hỗ trợ chu đáo.'],
  [4, 'Linh kiện thay thế và thời hạn bảo hành được giải thích rõ. Thời gian sửa tương đối hợp lý.'],
  [5, 'Máy được vệ sinh sạch sẽ trước khi trả. Nhân viên trả lời đầy đủ các thắc mắc của tôi.'],
  [4, 'Tôi đã thử tra cứu trên cả máy tính và điện thoại, đều xem được tiến độ. Mong sớm có thêm thông báo khi đổi lịch.'],
];

export const previewReviews = {
  reviewCount: comments.length,
  averageRating: Math.round(comments.reduce((sum, [rating]) => sum + rating, 0) / comments.length * 10) / 10,
  items: comments.map(([rating, comment], index) => ({
    id: `preview-${index + 1}`, rating, comment,
    reviewedOn: new Date(Date.UTC(2026, 9, 31 - index)).toISOString().slice(0, 10),
  })),
};
