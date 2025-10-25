function delay(msec, callback) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(callback()), Math.max(msec, 0));
  });
}

function raceAcks(replications, requiredSecondaryAcks) {
  return new Promise((resolve) => {
    let successCount = 0;
    let completed = 0;
    let resolved = false;
    const total = replications.length;

    for (const p of replications) {
      p.then((res) => {
        if (resolved) return;
        if (res.success) successCount++;
      }).finally(() => {
        completed++;
        if (!resolved && successCount >= requiredSecondaryAcks) {
          resolved = true;
          resolve({ success: true, acksReceived: successCount + 1 });
        } else if (completed === total && !resolved) {
          resolve({
            success: successCount >= requiredSecondaryAcks,
            acksReceived: successCount + 1,
          });
        }
      });
    }
  });
}

module.exports = { delay, raceAcks };
