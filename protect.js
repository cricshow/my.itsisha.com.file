(function () {
  const detectDevTools = () => {
    const threshold = 160;
    let widthThreshold = window.outerWidth - window.innerWidth > threshold;
    let heightThreshold = window.outerHeight - window.innerHeight > threshold;

    return widthThreshold || heightThreshold;
  };

  const redirectIfDevTools = () => {
    if (detectDevTools()) {
      document.body.innerHTML = `
        <div style="font-family:sans-serif; color:red; text-align:center; margin-top:50px;">
          <h2>😔 Sorry! Mistake Howi Hai</h2>
          <p>Please Try Again</p>
        </div>
      `;
    }
  };

  setInterval(redirectIfDevTools, 1000);
})();
