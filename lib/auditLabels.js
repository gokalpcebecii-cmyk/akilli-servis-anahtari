"use strict";

// OTOİZ P1 — işlem kaydı (audit_log) türlerinin Türkçe karşılıkları.
// Yönetim "İşlem Kaydı" sekmesi teknik ad yerine bunları gösterir.
const ACTION_LABELS = {
  vehicle_created: "Araç eklendi",
  maintenance_record_revised: "Servis kaydı düzeltildi",
  maintenance_record_deleted: "Bakım kaydı silindi",
  qr_key_assigned: "QR araca bağlandı",
  qr_key_revoked: "QR iptal edildi",
  product_activated: "Ürün etkinleştirildi",
  product_activation_locked: "Ürün etkinleştirme kilitlendi",
  product_activation_code_reissued: "Yeni etkinleştirme kodu verildi",
  product_batch_created: "Ürün partisi üretildi",
  product_batch_verified: "Parti doğrulandı",
  product_batch_codes_reissued: "Partiye yeni kodlar verildi",
  product_status_changed: "Ürün durumu değişti",
  product_archived: "Ürün arşivlendi",
  ownership_transfer_initiated: "Araç devri başlatıldı",
  ownership_transfer_completed: "Araç devri tamamlandı",
  ownership_transfer_cancelled: "Araç devri iptal edildi",
  service_application_submitted: "Servis başvurusu yapıldı",
  admin_service_approved: "Servis onaylandı",
  admin_service_rejected: "Servis reddedildi",
  admin_vehicle_owner_recovered: "Araç sahipliği yönetici tarafından düzeltildi",
  admin_qr_generated: "QR üretildi (destek)",
  admin_qr_assigned: "QR araca atandı (destek)",
  admin_qr_reserved: "QR servise ayrıldı",
  admin_qr_reserved_user: "QR kullanıcıya tanımlandı",
  admin_qr_unreserved: "QR ayırması kaldırıldı",
  admin_qr_revoked: "QR iptal edildi (yönetici)",
  user_feedback: "Görüş bildirildi",
};

function actionLabel(action) {
  return ACTION_LABELS[action] || String(action || "").replace(/_/g, " ");
}

module.exports = { ACTION_LABELS, actionLabel };
