<script>
  // Your Firebase Configuration (Keep it secure in a real app!)
  const firebaseConfig = {
    apiKey: "AIzaSyBNhvhiGQiZ3t7-FNEGl46Xi4XYrFsHgLc", // Replace with your actual API Key
    authDomain: "apkmalia-38ac2.firebaseapp.com",
    databaseURL: "https://apkmalia-38ac2-default-rtdb.firebaseio.com",
    projectId: "apkmalia-38ac2",
    storageBucket: "apkmalia-38ac2.appspot.com",
    messagingSenderId: "764227278305",
    appId: "1:764227278305:web:038a8cd3f0aff2af65aea0"
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.database();

  let currentUser = null; // Stores the current user's UID
  const pendingAlertsShown = {}; // To track alerts for pending status to avoid repeat alerts
  let cachedApprovedNumbersData = {}; // To store the snapshot of approved numbers for withdrawal

  let loginAttempts = 0; // Track failed login attempts

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
    // Check local storage for existing registration
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
        localStorage.setItem('deviceRegistered', 'true'); // Set flag on successful registration
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
        document.getElementById("userEmailDisplay").innerText = userCredential.user.email; // Display user's email
        showMain();
        loginAttempts = 0; // Reset login attempts on successful login
      })
      .catch(err => {
        console.error("Login Error:", err);
        loginAttempts++;
        if (loginAttempts >= 3) {
            alert("Too many failed login attempts. Redirecting to WhatsApp for support.");
            forgotPassword(); // Redirect to WhatsApp
            loginAttempts = 0; // Reset after redirect
        } else {
            alert(err.message + ` (${3 - loginAttempts} attempts remaining before WhatsApp redirect)`);
        }
      });
  }

  function logout() {
    auth.signOut().then(() => {
      currentUser = null;
      alert("Logged out successfully!");
      switchToLogin(); // Go back to login screen
    }).catch(err => {
      console.error("Logout Error:", err);
      alert("Failed to logout: " + err.message);
    });
  }

  function forgotPassword() {
    const whatsappNumber = "03293250820"; // Replace with your WhatsApp number
    const message = encodeURIComponent("Main Password Bhol Gia Pls Resend Me");
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappLink, '_blank'); // Open in new tab/window
  }

  function showMain() {
    hideAllScreens(); // Hide all other screens
    document.getElementById("title").innerText = "Dashboard";
    document.getElementById("mainScreen").classList.add("visible");
    loadNumbers(); // Load numbers when main screen is shown
    loadWithdrawalHistory(); // Load withdrawal history
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
    // Basic validation for numbers (can be improved)
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
            status: "Pending", // Default status
            amount: 1, // Initial amount is Rs. 1.00
            lastUpdate: Date.now(), // Timestamp for last update
            previousStatus: "Pending" // Initialize previous status
          })
          .then(() => {
            alert("WhatsApp number added successfully!");
            numberInput.value = ""; // Clear input after adding
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
      // For a specific format like 24/07/2025, 5:09:53 pm
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
      numberListDiv.innerHTML = ""; // Clear previous list
      let totalEarnedAmount = 0;
      cachedApprovedNumbersData = {}; // Reset cache for approved numbers

      if (!snap.exists() || snap.val() === null) {
        numberListDiv.innerHTML = "<p style='text-align: center; color: #888;'>No WhatsApp numbers added yet.</p>";
        document.getElementById("withdrawStatus").innerText = `Total Earned: Rs.${totalEarnedAmount.toFixed(2)}`;
        return;
      }

      const updatesForFirebase = {}; // Object to hold updates for Firebase batch update

      snap.forEach(childSnapshot => {
        const numberKey = childSnapshot.key;
        const numberData = childSnapshot.val();
        const currentStatus = numberData.status;
        let currentAmount = numberData.amount || 0;
        const lastUpdateTime = numberData.lastUpdate || 0;
        const previousStatus = numberData.previousStatus || "Unknown"; // Default to Unknown if not set

        // --- START OF MODIFICATION ---
        // Removed the logic that cuts the amount when status changes from Approved to Pending.
        // The amount will now only be reset upon successful withdrawal.
        // --- END OF MODIFICATION ---
        
        // If current status is Approved, we still cache it for withdrawal calculation
        if (currentStatus === "Approved") {
             cachedApprovedNumbersData[numberKey] = { ...numberData, amount: currentAmount };
        }
        
        // Always update previousStatus to currentStatus for next check
        // This ensures the 'previousStatus' always reflects the last known status from Firebase,
        // which can be used for other future logic if needed.
        if (previousStatus !== currentStatus) {
            updatesForFirebase[`/${numberKey}/previousStatus`] = currentStatus;
        }

        totalEarnedAmount += currentAmount;

        const statusText = currentStatus === "Approved" ? "Approved &#9989 &#127881" : "Pending &#10060 &#128557";
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

      // Apply all updates to Firebase in one go if there are any
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
      // Reset form fields
      document.getElementById("accountName").value = "";
      document.getElementById("accountNumber").value = "";
      document.getElementById("selectedPaymentMethod").value = "";
      // Deselect all payment methods
      document.querySelectorAll(".payment-method-option").forEach(option => {
          option.classList.remove("selected");
      });
  }

  function hideWithdrawForm() {
      document.getElementById("withdrawFormScreen").style.display = "none";
  }

  function selectPaymentMethod(methodId) {
      document.querySelectorAll(".payment-method-option").forEach(option => {
          option.classList.remove("selected");
      });
      document.getElementById(methodId.toLowerCase()).classList.add("selected");
      document.getElementById("selectedPaymentMethod").value = methodId;
  }

  // --- Withdraw Function ---
  function submitWithdraw() {
    if (!currentUser) {
      alert("Please login first to submit a withdraw request.");
      return;
    }

    let currentTotalApprovedAmount = 0;

    // Use cached data to calculate total approved amount
    for (const key in cachedApprovedNumbersData) {
        if (cachedApprovedNumbersData[key].status === "Approved") {
            currentTotalApprovedAmount += (cachedApprovedNumbersData[key].amount || 0);
        }
    }

    // Minimum amount needed to initiate withdrawal (e.g., to receive at least Rs. 100 after 5% fee)
    // If you want to receive 100, then 100 / (1 - 0.05) = 100 / 0.95 = 105.26
    const minimumWithdrawalRequirement = 106; // Set a slightly higher minimum to ensure at least 100 is paid out

    if (currentTotalApprovedAmount >= minimumWithdrawalRequirement) {
      // Show the withdrawal form
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
      // Re-calculate total earned from cached data to ensure accuracy
      for (const key in cachedApprovedNumbersData) {
          if (cachedApprovedNumbersData[key].status === "Approved") {
              currentTotalApprovedAmount += (cachedApprovedNumbersData[key].amount || 0);
          }
      }

      const withdrawalFeePercentage = 0.05; // 5%
      const calculatedFee = currentTotalApprovedAmount * withdrawalFeePercentage;
      const amountUserReceives = currentTotalApprovedAmount - calculatedFee; 
      
      const minimumWithdrawalRequirement = 106; // Same as in submitWithdraw

      // If the current total is less than the minimum required (after re-check)
      if (currentTotalApprovedAmount < minimumWithdrawalRequirement) { 
           alert(`Your balance has changed. Please try again. Minimum Rs.${minimumWithdrawalRequirement.toFixed(2)} required.`);
           hideWithdrawForm();
           return;
      }
      
      // Prepare updates to reset ALL approved numbers to 0
      const updates = {};
      for (const key in cachedApprovedNumbersData) {
          if (cachedApprovedNumbersData[key].status === "Approved") {
              updates["/" + key + "/amount"] = 0; // Reset to 0
              updates["/" + key + "/lastUpdate"] = Date.now(); // Reset last update time
          }
      }

      // Record the withdrawal request
      db.ref("payments/" + currentUser).push({
        amountRequested: amountUserReceives.toFixed(2), // Amount user actually gets, formatted to 2 decimal places
        fee: calculatedFee.toFixed(2), // Fee amount, formatted
        totalAmountDeducted: currentTotalApprovedAmount.toFixed(2), // Total earned amount that is being reset
        totalEarnedBeforeWithdrawal: currentTotalApprovedAmount.toFixed(2), // Total before this withdrawal
        status: "Pending", // Withdrawals are pending until admin approves
        date: Date.now(), // Store timestamp, format on display using formatTimestamp
        accountName: accountName,
        accountNumber: accountNumber,
        paymentMethod: paymentMethod
      }).then(() => {
        // Apply the calculated deductions (reset to 0) to Firebase
        return db.ref("whatsapps/" + currentUser).update(updates); 
      })
      .then(() => {
        alert(`Withdrawal Request Sent! Rs.${amountUserReceives.toFixed(2)} (after Rs.${calculatedFee.toFixed(2)} fee) will be processed to your ${paymentMethod} account. Your approved numbers' balances have been reset to Rs.0.`);
        hideWithdrawForm(); // Hide the form after submission
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

      const userPaymentsRef = db.ref("payments/" + currentUser).orderByChild("date"); // Order by date
      userPaymentsRef.on("value", snap => {
          historyListDiv.innerHTML = ""; // Clear previous list
          if (!snap.exists() || snap.val() === null) {
              historyListDiv.innerHTML = "<p style='text-align: center; color: #888;'>No withdrawal history found.</p>";
              return;
          }

          const payments = [];
          snap.forEach(childSnapshot => {
              payments.push({ id: childSnapshot.key, ...childSnapshot.val() });
          });

          // Sort by date (descending) to show most recent first, since orderByChild("date") gives ascending
          payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 

          payments.forEach(payment => {
              const statusClass = payment.status === "Approved" ? "status-approved-history" : (payment.status === "Pending" ? "status-pending-history" : "");
              
              // Format date for display in history
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

  // --- Initial Auth State Check ---
  // This runs when the page loads to check if a user is already logged in
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user.uid;
      document.getElementById("userEmailDisplay").innerText = user.email; // Display user's email on load
      showMain(); // If logged in, show the main dashboard
    } else {
      switchToLogin(); // If not logged in, ensure login screen is visible
    }
  });

  // --- Disable Right-Click ---
  document.addEventListener('contextmenu', event => event.preventDefault());

  // Ensure DOM is fully loaded before trying to access elements
  document.addEventListener('DOMContentLoaded', () => {
    // Any setup that needs to run after HTML is parsed goes here
  });
</script>
