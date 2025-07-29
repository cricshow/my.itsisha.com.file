// Global variables (will be initialized after Firebase is loaded)
  let currentUser = null;
  const pendingAlertsShown = {};
  let cachedApprovedNumbersData = {};
  let previousNumberStatuses = {};
  let loginAttempts = 0;

  // Wait for the DOM to be fully loaded and Firebase to be initialized
  document.addEventListener('DOMContentLoaded', () => {
    // Only attach event listeners and start main logic if Firebase (auth and db) is available
    if (typeof window.auth !== 'undefined' && typeof window.db !== 'undefined') {

      // Initial Auth State Check
      auth.onAuthStateChanged(user => {
        if (user) {
          currentUser = user.uid;
          document.getElementById("userEmailDisplay").innerText = user.email;
          showMain();
          checkAndShowVideoPopup();
        } else {
          switchToLogin();
        }
      });

      // --- Attach Event Listeners ---
      document.getElementById("loginBtn").addEventListener("click", login);
      document.getElementById("registerSwitchBtn").addEventListener("click", switchToRegister);
      document.getElementById("forgotPasswordBtn").addEventListener("click", forgotPassword);
      document.getElementById("registerBtn").addEventListener("click", register);
      document.getElementById("loginSwitchBtn").addEventListener("click", switchToLogin);
      document.getElementById("logoutBtn").addEventListener("click", logout);
      document.getElementById("submitWithdrawBtn").addEventListener("click", submitWithdraw);
      document.getElementById("addNumberBtn").addEventListener("click", addNumber);
      document.getElementById("processWithdrawalBtn").addEventListener("click", processWithdrawal);
      document.getElementById("hideWithdrawFormBtn").addEventListener("click", hideWithdrawForm);
      document.getElementById("closeVideoTempBtn").addEventListener("click", closeVideoTemporarily);
      document.getElementById("skipVideoPermBtn").addEventListener("click", skipVideoPermanently);

      // Attach event listeners for payment methods
      document.querySelectorAll(".payment-method-option").forEach(option => {
          option.addEventListener("click", () => selectPaymentMethod(option.dataset.method));
      });

      // Disable Right-Click
      document.addEventListener('contextmenu', event => event.preventDefault());

    } else {
      console.warn("Firebase (auth/db) not yet available when DOMContentLoaded fired for app logic. Waiting for Firebase script.");
      // This case should ideally not happen if 'defer' is used correctly and Firebase config script is first.
    }
  });

  // --- UI Switching Functions ---
  function hideAllScreens() {
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("visible"));
  }

  function switchToRegister() {
    hideAllScreens();
    document.getElementById("title").innerText = "Register";
    document.getElementById("registerScreen").classList.add("visible");
  }

  function switchToLogin() {
    hideAllScreens();
    document.getElementById("title").innerText = "Login";
    document.getElementById("loginScreen").classList.add("visible");
  }

  // --- Authentication Functions ---
  function register() {
    if (localStorage.getItem('deviceRegistered') === 'true') {
        alert("This device is already registered with an account. You cannot register another account from this device.");
        return;
    }
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
    auth.createUserWithEmailAndPassword(email, password)
      .then(() => {
        alert("Registration successful! Please login.");
        localStorage.setItem('deviceRegistered', 'true');
        switchToLogin();
      })
      .catch(err => {
        console.error("Registration Error:", err);
        alert(err.message);
      });
  }

  function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
    auth.signInWithEmailAndPassword(email, password)
      .then(userCredential => {
        currentUser = userCredential.user.uid;
        document.getElementById("userEmailDisplay").innerText = userCredential.user.email;
        showMain();
        loginAttempts = 0;
        checkAndShowVideoPopup();
      })
      .catch(err => {
        console.error("Login Error:", err);
        loginAttempts++;
        if (loginAttempts >= 3) {
            alert("Too many failed login attempts. Redirecting to WhatsApp for support.");
            forgotPassword();
            loginAttempts = 0;
        } else {
            alert(err.message + ` (${3 - loginAttempts} attempts remaining before WhatsApp redirect)`);
        }
      });
  }

  function logout() {
    auth.signOut().then(() => {
      currentUser = null;
      alert("Logged out successfully!");
      switchToLogin();
    }).catch(err => {
      console.error("Logout Error:", err);
      alert("Failed to logout: " + err.message);
    });
  }

  function forgotPassword() {
    const whatsappNumber = "+923293250820";
    const message = encodeURIComponent("Main Password Bhol Gia Pls Resend Me");
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappLink, '_blank');
  }

  function showMain() {
    hideAllScreens();
    document.getElementById("title").innerText = "Dashboard";
    document.getElementById("mainScreen").classList.add("visible");
    loadNotifications();
    loadNumbers();
    loadWithdrawalHistory();
  }

  // --- WhatsApp Number Functions ---
  function addNumber() {
    const numberInput = document.getElementById("waNumber");
    const number = numberInput.value.trim();
    if (!currentUser) {
      alert("Please login first.");
      return;
    }
    if (!number) {
      alert("Please enter a WhatsApp number.");
      return;
    }
    if (!/^\d+$/.test(number)) {
      alert("Please enter a valid numeric WhatsApp number.");
      return;
    }
    const numberRef = db.ref("whatsapps/" + currentUser + "/" + number);
    numberRef.once("value")
      .then(snap => {
        if (snap.exists()) {
          alert("This WhatsApp number has already been added.");
        } else {
          numberRef.set({
            status: "Pending",
            amount: 1,
            lastUpdate: Date.now(),
          })
          .then(() => {
            alert("WhatsApp number added successfully!");
            numberInput.value = "";
          })
          .catch(err => {
            console.error("Error adding number:", err);
            alert("Failed to add number: " + err.message);
          });
        }
      })
      .catch(err => {
        console.error("Error checking number existence:", err);
        alert("An error occurred. Please try again.");
      });
  }

  // Helper function to format timestamp to 12-hour AM/PM
  function formatTimestamp(timestamp) {
      if (!timestamp) return "N/A";
      const date = new Date(timestamp);
      const formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
      const formattedTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(date);
      return `${formattedDate}, ${formattedTime}`;
  }

  function loadNumbers() {
    const numberListDiv = document.getElementById("numberList");
    if (!currentUser) {
      numberListDiv.innerHTML = "<p style='text-align: center; color: #888;'>Please login to see your numbers.</p>";
      return;
    }
    const userNumbersRef = db.ref("whatsapps/" + currentUser);
    userNumbersRef.on("value", snap => {
      numberListDiv.innerHTML = "";
      let totalEarnedAmount = 0;
      cachedApprovedNumbersData = {};
      if (!snap.exists() || snap.val() === null) {
        numberListDiv.innerHTML = "<p style='text-align: center; color: #888;'>No WhatsApp numbers added yet.</p>";
        document.getElementById("withdrawStatus").innerText = `Total Earned: Rs.${totalEarnedAmount.toFixed(2)}`;
        previousNumberStatuses = {};
        return;
      }
      const updatesForFirebase = {};
      const currentSnapshotStatuses = {};
      snap.forEach(childSnapshot => {
        const numberKey = childSnapshot.key;
        const numberData = childSnapshot.val();
        const currentStatus = numberData.status;
        let currentAmount = numberData.amount || 0;
        const lastUpdateTime = numberData.lastUpdate || 0;
        
        currentSnapshotStatuses[numberKey] = currentStatus;
        if (previousNumberStatuses[numberKey] === "Approved" && currentStatus === "Pending" && !pendingAlertsShown[numberKey]) {
            alert(`Attention: Apka Number ${numberKey} Whatsapp Se Remove Howa Pls Usko Dobarah Add Krwa Lu`);
            pendingAlertsShown[numberKey] = true;
        } else if (currentStatus === "Approved") {
            delete pendingAlertsShown[numberKey];
        }

        if (currentStatus === "Approved") {
             cachedApprovedNumbersData[numberKey] = { ...numberData, amount: currentAmount };
        }
        
        totalEarnedAmount += currentAmount;
        const statusText = currentStatus === "Approved" ? " &#9989 &#127881" : " &#10060 &#128557";
        const statusClass = currentStatus === "Approved" ? "status-approved" : "status-pending";
        numberListDiv.innerHTML += `
          <div class="number">
            <b>${numberKey}</b><br>
            <span>Status: <span class="${statusClass}">${statusText}</span></span><br>
            <span>Earned: Rs.${currentAmount.toFixed(2)}</span>
            <span>Last Update: ${formatTimestamp(lastUpdateTime)}</span>
          </div>
        `;
      });
      previousNumberStatuses = { ...currentSnapshotStatuses };
      if (Object.keys(updatesForFirebase).length > 0) {
        userNumbersRef.update(updatesForFirebase)
          .catch(err => console.error("Error updating numbers in batch:", err));
      }
      document.getElementById("withdrawStatus").innerText = `Total Earned: Rs.${totalEarnedAmount.toFixed(2)}`;
    });
  }

  // --- Withdrawal Form Functions ---
  function showWithdrawForm() {
      document.getElementById("withdrawFormScreen").style.display = "flex";
      document.getElementById("accountName").value = "";
      document.getElementById("accountNumber").value = "";
      document.getElementById("selectedPaymentMethod").value = "";
      document.querySelectorAll(".payment-method-option").forEach(option => {
          option.classList.remove("selected");
      });
  }

  function hideWithdrawForm() {
      document.getElementById("withdrawFormScreen").style.display = "none";
  }

  function selectPaymentMethod(method) {
      document.querySelectorAll(".payment-method-option").forEach(option => {
          option.classList.remove("selected");
      });
      const selectedOption = document.querySelector(`.payment-method-option[data-method="${method}"]`);
      if (selectedOption) {
          selectedOption.classList.add("selected");
          document.getElementById("selectedPaymentMethod").value = method;
      }
  }

  // --- Withdraw Function ---
  function submitWithdraw() {
    if (!currentUser) {
      alert("Please login first to submit a withdraw request.");
      return;
    }
    let currentTotalApprovedAmount = 0;
    for (const key in cachedApprovedNumbersData) {
        if (cachedApprovedNumbersData[key].status === "Approved") {
            currentTotalApprovedAmount += (cachedApprovedNumbersData[key].amount || 0);
        }
    }
    const minimumWithdrawalRequirement = 106;
    if (currentTotalApprovedAmount >= minimumWithdrawalRequirement) {
      showWithdrawForm();
    } else {
      alert(`Minimum Rs.${minimumWithdrawalRequirement.toFixed(2)} required to withdraw. You currently have Rs.${currentTotalApprovedAmount.toFixed(2)}.`);
    }
  }

  function processWithdrawal() {
      const accountName = document.getElementById("accountName").value.trim();
      const accountNumber = document.getElementById("accountNumber").value.trim();
      const paymentMethod = document.getElementById("selectedPaymentMethod").value;
      if (!accountName || !accountNumber || !paymentMethod) {
          alert("Please fill in all withdrawal details and select a payment method.");
          return;
      }
      let currentTotalApprovedAmount = 0;
      for (const key in cachedApprovedNumbersData) {
          if (cachedApprovedNumbersData[key].status === "Approved") {
              currentTotalApprovedAmount += (cachedApprovedNumbersData[key].amount || 0);
          }
      }
      const withdrawalFeePercentage = 0.05;
      const calculatedFee = currentTotalApprovedAmount * withdrawalFeePercentage;
      const amountUserReceives = currentTotalApprovedAmount - calculatedFee; 
      const minimumWithdrawalRequirement = 106;
      if (currentTotalApprovedAmount < minimumWithdrawalRequirement) { 
           alert(`Your balance has changed. Please try again. Minimum Rs.${minimumWithdrawalRequirement.toFixed(2)} required.`);
           hideWithdrawForm();
           return;
      }
      const updates = {};
      for (const key in cachedApprovedNumbersData) {
          if (cachedApprovedNumbersData[key].status === "Approved") {
              updates["/" + key + "/amount"] = 0;
              updates["/" + key + "/lastUpdate"] = Date.now();
          }
      }
      db.ref("payments/" + currentUser).push({
        amountRequested: amountUserReceives.toFixed(2),
        fee: calculatedFee.toFixed(2),
        totalAmountDeducted: currentTotalApprovedAmount.toFixed(2),
        totalEarnedBeforeWithdrawal: currentTotalApprovedAmount.toFixed(2),
        status: "Pending",
        date: Date.now(),
        accountName: accountName,
        accountNumber: accountNumber,
        paymentMethod: paymentMethod
      }).then(() => {
        return db.ref("whatsapps/" + currentUser).update(updates); 
      })
      .then(() => {
        alert(`Withdrawal Request Sent! Rs.${amountUserReceives.toFixed(2)} (after Rs.${calculatedFee.toFixed(2)} fee) will be processed to your ${paymentMethod} account. Your approved numbers' balances have been reset to Rs.0.`);
        hideWithdrawForm();
      })
      .catch(err => {
        console.error("Error during withdrawal process:", err);
        alert("Failed to submit withdraw request: " + err.message);
      });
  }

  // --- Load Withdrawal History Function ---
  function loadWithdrawalHistory() {
      const historyListDiv = document.getElementById("withdrawalHistory");
      if (!currentUser) {
          historyListDiv.innerHTML = "<p style='text-align: center; color: #888;'>Please login to see your withdrawal history.</p>";
          return;
      }
      const userPaymentsRef = db.ref("payments/" + currentUser).orderByChild("date");
      userPaymentsRef.on("value", snap => {
          historyListDiv.innerHTML = "";
          if (!snap.exists() || snap.val() === null) {
              historyListDiv.innerHTML = "<p style='text-align: center; color: #888;'>No withdrawal history found.</p>";
              return;
          }
          const payments = [];
          snap.forEach(childSnapshot => {
              payments.push({ id: childSnapshot.key, ...childSnapshot.val() });
          });
          payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
          payments.forEach(payment => {
              const statusClass = payment.status === "Approved" ? "status-approved-history" : (payment.status === "Pending" ? "status-pending-history" : "");
              let displayDate = formatTimestamp(payment.date); 
              historyListDiv.innerHTML += `
                  <div class="history-item">
                      <p><strong>Amount:</strong> Rs.${parseFloat(payment.amountRequested).toFixed(2)} (Fee: Rs.${parseFloat(payment.fee || 0).toFixed(2)})</p>
                      <p><strong>Method:</strong> ${payment.paymentMethod}</p>
                      <p><strong>Account:</strong> ${payment.accountNumber}</p>
                      <p><strong>Date:</strong> ${displayDate}</p>
                      <p><strong>Status:</strong> <span class="${statusClass}">${payment.status}</span></p>
                  </div>
              `;
          });
      });
  }

  // --- Notifications Function ---
  function loadNotifications() {
      const notificationListDiv = document.getElementById("notificationList");
      const notificationsRef = db.ref("notifications");
      notificationsRef.on("value", snap => {
          notificationListDiv.innerHTML = "";
          if (!snap.exists() || snap.val() === null) {
              notificationListDiv.innerHTML = "<p style='text-align: center; color: #888;'>No new notifications.</p>";
              return;
          }
          const notifications = [];
          snap.forEach(childSnapshot => {
              const notificationData = childSnapshot.val();
              if (typeof notificationData === 'object' && notificationData !== null && notificationData.message) { 
                notifications.push({
                    id: childSnapshot.key,
                    message: notificationData.message,
                    date: notificationData.date || null 
                });
              } else if (typeof notificationData === 'string') {
                  notifications.push({
                      id: childSnapshot.key,
                      message: notificationData,
                      date: null 
                  });
              }
          });
          notifications.sort((a, b) => {
              if (a.date && b.date) {
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
              }
              return a.id.localeCompare(b.id);
          });
          if (notifications.length === 0) {
              notificationListDiv.innerHTML = "<p style='text-align: center; color: #888;'>No new notifications.</p>";
              return;
          }
          notifications.forEach(notification => {
              const displayDate = notification.date ? formatTimestamp(notification.date) : '';
              notificationListDiv.innerHTML += `
                  <div class="notification-item">
                      <p>${notification.message}</p>
                      ${displayDate ? `<span class="notification-date">${displayDate}</span>` : ''}
                  </div>
              `;
          });
      }, error => {
          console.error("Error loading notifications:", error);
          notificationListDiv.innerHTML = "<p style='text-align: center; color: #dc3545;'>Error loading notifications.</p>";
      });
  }

  // --- Video Popup Functions ---
  function checkAndShowVideoPopup() {
    if (localStorage.getItem('videoPermanentlySkipped') === 'true') {
        return;
    }
    const videoRef = db.ref("videoEmbedLink");
    videoRef.once("value")
        .then(snap => {
            const videoLink = snap.val();
            if (videoLink) {
                const videoContainer = document.getElementById("videoContainer");
                let embedUrl = videoLink;
                if (videoLink.includes("ok.ru/video/")) {
                    embedUrl = videoLink.replace("ok.ru/video/", "ok.ru/videoembed/");
                }
                videoContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
                document.getElementById("videoPopupOverlay").style.display = "flex";
            }
        })
        .catch(error => {
            console.error("Error fetching video link:", error);
        });
  }

  function closeVideoTemporarily() {
    document.getElementById("videoPopupOverlay").style.display = "none";
    const videoContainer = document.getElementById("videoContainer");
    videoContainer.innerHTML = '';
  }

  function skipVideoPermanently() {
    document.getElementById("videoPopupOverlay").style.display = "none";
    localStorage.setItem('videoPermanentlySkipped', 'true');
    const videoContainer = document.getElementById("videoContainer");
    videoContainer.innerHTML = '';
  }
