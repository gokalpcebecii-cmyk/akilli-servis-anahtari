function kmRemaining(currentKm, nextServiceKm) {
  if (nextServiceKm == null) return null;
  return nextServiceKm - currentKm;
}

function daysRemaining(todayISO, nextServiceDateISO) {
  if (!nextServiceDateISO) return null;
  const today = new Date(todayISO);
  const target = new Date(nextServiceDateISO);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function shouldSendReminder({ currentKm, nextServiceKm, nextServiceDateISO, todayISO, reminderKmBefore, reminderDaysBefore }) {
  const kmLeft = kmRemaining(currentKm, nextServiceKm);
  const daysLeft = daysRemaining(todayISO, nextServiceDateISO);

  const kmTrigger = kmLeft != null && kmLeft <= reminderKmBefore;
  const dateTrigger = daysLeft != null && daysLeft <= reminderDaysBefore;

  return kmTrigger || dateTrigger;
}

function prepareOwnershipTransfer(previousCustomer, transferDateISO) {
  if (!previousCustomer) {
    return {
      anonymizedSnapshot: { note: "onceki sahip kaydi yok", transfer_date: transferDateISO },
      fieldsToErase: [],
    };
  }

  return {
    anonymizedSnapshot: {
      had_owner: true,
      owner_since_unknown: true,
      transfer_date: transferDateISO,
    },
    fieldsToErase: ["full_name", "phone", "email"],
  };
}

function anonymizeCustomerRecord() {
  return {
    full_name: "Silinmis Kullanici",
    phone: null,
    email: null,
  };
}

module.exports = {
  kmRemaining,
  daysRemaining,
  shouldSendReminder,
  prepareOwnershipTransfer,
  anonymizeCustomerRecord,
};
