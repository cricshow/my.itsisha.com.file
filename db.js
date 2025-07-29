  const firebaseConfig = {
    apiKey: "AIzaSyBNhvhiGQiZ3t7-FNEGl46Xi4XYrFsHgLc", // Replace with your actual API Key
    authDomain: "apkmalia-38ac2.firebaseapp.com",
    databaseURL: "https://apkmalia-38ac2-default-rtdb.firebaseio.com",
    projectId: "apkmalia-38ac2",
    storageBucket: "apkmalia-38ac2.appspot.com",
    messagingSenderId: "764227278305",
    appId: "1:764227278305:web:038a8cd3f0aff2af65aea0"
  };

  // Ensure Firebase SDK is loaded before initializing
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
      firebase.initializeApp(firebaseConfig);
      // Make auth and db globally accessible
      window.auth = firebase.auth();
      window.db = firebase.database();
      console.log("Firebase initialized successfully.");
    } else {
      console.error("Firebase SDK not loaded. Check CDN links or network connection.");
      alert("Application could not load essential components. Please try again or check your internet connection.");
    }
  });
