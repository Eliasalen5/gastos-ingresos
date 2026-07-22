const firebaseConfig = {
    apiKey: "AIzaSyBkgaGE0W8CakSUtthZBNU0JrSy0hPnSEk",
    authDomain: "gastos-ingresos-5238d.firebaseapp.com",
    projectId: "gastos-ingresos-5238d",
    storageBucket: "gastos-ingresos-5238d.firebasestorage.app",
    messagingSenderId: "150707601988",
    appId: "1:150707601988:web:e78dcee12ee685af207211"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();