function delay(msec, callback) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(callback()), Math.max(msec, 0));
  });
}

module.exports = { delay };
