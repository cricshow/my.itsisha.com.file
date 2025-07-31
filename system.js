document.addEventListener("DOMContentLoaded", function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "register.html";
    return;
  }

  const firebaseConfig = {
    apiKey: "AIzaSyBNhvhiGQiZ3t7-FNEGl46Xi4XYrFsHgLc",
    authDomain: "apkmalia-38ac2.firebaseapp.com",
    databaseURL: "https://apkmalia-38ac2-default-rtdb.firebaseio.com",
    projectId: "apkmalia-38ac2",
    storageBucket: "apkmalia-38ac2.appspot.com",
    messagingSenderId: "352820438284",
    appId: "1:352820438284:web:a29f58ec7f401e3de97b13"
  };

  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();

  const whatsappList = document.getElementById("whatsappList");
  const totalAmountEl = document.getElementById("totalAmount");

  function updateTotalAmount(userId) {
    database.ref(`whatsapps/${userId}`).once("value", (snapshot) => {
      let total = 0;
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        total += parseInt(data.points || 0);
      });
      totalAmountEl.textContent = total;
    });
  }

  function renderWhatsapps(userId) {
    database.ref(`whatsapps/${userId}`).on("value", (snapshot) => {
      whatsappList.innerHTML = "";
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const data = childSnapshot.val();

        const whatsappItem = document.createElement("div");
        whatsappItem.className = "whatsapp-item";

        const statusColor = data.status === "Approved" ? "#4CAF50" : "#f44336";

        whatsappItem.innerHTML = `
          <div class="whatsapp-number">${data.number}</div>
          <div class="whatsapp-status" style="color: ${statusColor};">${data.status}</div>
          <div class="whatsapp-points">${data.points} Rs</div>
          <div class="pocket-icon" data-id="${key}" data-points="${data.points}">
            <img src="pocket.png" alt="Pocket" />
          </div>
        `;
        whatsappList.appendChild(whatsappItem);
      });

      updateTotalAmount(userId);
    });
  }

  function selectPaymentMethod(method) {
    document.querySelectorAll(".payment-method-option").forEach(el => {
      el.classList.remove("selected");
    });
    const selectedEl = document.querySelector(`.payment-method-option[data-method="${method}"]`);
    if (selectedEl) {
      selectedEl.classList.add("selected");
    }
    document.getElementById("paymentMethod").value = method;
  }

  // ✅ Use event delegation for dynamic elements
  document.addEventListener("click", function(event) {
    const methodOption = event.target.closest(".payment-method-option");
    if (methodOption) {
      selectPaymentMethod(methodOption.dataset.method);
    }

    const pocketIcon = event.target.closest(".pocket-icon");
    if (pocketIcon) {
      const id = pocketIcon.dataset.id;
      const points = parseInt(pocketIcon.dataset.points);
      if (points >= 50) {
        document.getElementById("withdrawForm").style.display = "block";
        document.getElementById("withdrawId").value = id;
        document.getElementById("amount").value = points;
      } else {
        alert("کم از کم رقم 50Rs ہونی چاہیے۔");
      }
    }

    if (event.target.id === "cancelWithdraw") {
      document.getElementById("withdrawForm").style.display = "none";
    }
  });

  document.getElementById("submitWithdraw").addEventListener("click", () => {
    const id = document.getElementById("withdrawId").value;
    const amount = parseInt(document.getElementById("amount").value);
    const accountName = document.getElementById("accountName").value.trim();
    const accountNumber = document.getElementById("accountNumber").value.trim();
    const method = document.getElementById("paymentMethod").value;

    if (!accountName || !accountNumber || !method) {
      alert("براہ کرم تمام فیلڈز مکمل کریں۔");
      return;
    }

    const paymentData = {
      accountName,
      accountNumber,
      method,
      amount,
      status: "Pending"
    };

    const paymentRef = database.ref(`payments/${userId}`);
    paymentRef.once("value", (snapshot) => {
      let alreadySubmitted = false;
      snapshot.forEach((childSnapshot) => {
        const payment = childSnapshot.val();
        if (
          payment.accountNumber === accountNumber &&
          payment.method === method &&
          payment.status === "Pending"
        ) {
          alreadySubmitted = true;
        }
      });

      if (alreadySubmitted) {
        alert("آپ نے پہلے ہی اسی اکاؤنٹ اور میتھڈ سے درخواست دی ہے۔");
      } else {
        const newRef = paymentRef.push();
        newRef.set(paymentData).then(() => {
          database.ref(`whatsapps/${userId}/${id}/points`).set(0);
          document.getElementById("withdrawForm").style.display = "none";
          document.getElementById("accountName").value = "";
          document.getElementById("accountNumber").value = "";
          document.getElementById("paymentMethod").value = "";
          updateTotalAmount(userId);
          alert("آپ کی درخواست موصول ہو گئی ہے۔");
        });
      }
    });
  });

  renderWhatsapps(userId);
});
