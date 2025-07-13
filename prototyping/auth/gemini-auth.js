import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';

// Ensure these global variables are defined by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Main App component
function App() {
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [highScores, setHighScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      const firebaseApp = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(firebaseApp);
      const firebaseAuth = getAuth(firebaseApp);

      setApp(firebaseApp);
      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Listen for authentication state changes
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setCurrentUser(user);
          setUserId(user.uid);
          console.log("User authenticated:", user.uid);

          // Increment login count for the user
          await incrementLoginCount(firestoreDb, user.uid);
        } else {
          setCurrentUser(null);
          setUserId(null);
          console.log("User logged out.");
        }
        setLoading(false);
      });

      // Attempt to sign in with custom token or anonymously
      const signInUser = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
            console.log("Signed in with custom token.");
          } else {
            await signInAnonymously(firebaseAuth);
            console.log("Signed in anonymously.");
          }
        } catch (e) {
          console.error("Error during initial sign-in:", e);
          setError("Failed to sign in automatically. Please try logging in manually.");
        }
      };

      signInUser();

      // Clean up the auth listener on component unmount
      return () => unsubscribe();
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      setError("Failed to initialize Firebase. Please check your configuration.");
      setLoading(false);
    }
  }, []);

  // Function to increment user's login count
  const incrementLoginCount = async (firestoreDb, uid) => {
    if (!firestoreDb || !uid) {
      console.warn("Firestore DB or UID not available for incrementing login count.");
      return;
    }
    const userDocRef = doc(firestoreDb, `/artifacts/${appId}/public/data/highScores`, uid);
    try {
      const docSnap = await getDoc(userDocRef);
      let newLoginCount = 1;
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        newLoginCount = (currentData.loginCount || 0) + 1;
        console.log(`Incrementing login count for ${uid} from ${currentData.loginCount} to ${newLoginCount}`);
      } else {
        console.log(`Creating new entry for ${uid} with login count 1`);
      }
      await setDoc(userDocRef, { userId: uid, loginCount: newLoginCount }, { merge: true });
    } catch (e) {
      console.error("Error incrementing login count:", e);
      setError("Failed to update login count.");
    }
  };

  // Fetch and listen for real-time updates to high scores
  useEffect(() => {
    if (db && userId) { // Ensure db is initialized and user is authenticated
      const highScoresCollectionRef = collection(db, `/artifacts/${appId}/public/data/highScores`);
      // Note: orderBy is commented out due to potential index issues in Canvas environment.
      // Data will be sorted in memory.
      const q = query(highScoresCollectionRef); // , orderBy("loginCount", "desc"), limit(10)

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const scores = snapshot.docs.map(d => d.data());
        // Sort scores in memory as orderBy can cause issues without proper indexing
        scores.sort((a, b) => b.loginCount - a.loginCount);
        setHighScores(scores);
        console.log("High scores updated:", scores);
      }, (e) => {
        console.error("Error fetching high scores:", e);
        setError("Failed to load high scores.");
      });

      return () => unsubscribe(); // Clean up the listener
    }
  }, [db, userId]); // Re-run when db or userId changes

  // Handle user logout
  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        console.log("User signed out.");
        // No need to set currentUser/userId to null here, onAuthStateChanged will handle it
      } catch (e) {
        console.error("Error signing out:", e);
        setError("Failed to log out.");
      }
    }
  };

  // Handle user login (primarily for re-logging in if initial token fails or after logout)
  const handleLogin = async () => {
    if (auth) {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
          console.log("Attempted sign in with custom token.");
        } else {
          await signInAnonymously(auth);
          console.log("Attempted anonymous sign in.");
        }
      } catch (e) {
        console.error("Error during manual sign-in:", e);
        setError("Failed to log in. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p className="text-xl">Loading Firebase...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-900 text-white p-4">
        <p className="text-xl font-bold">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter p-4 sm:p-8 flex flex-col items-center">
      <div className="bg-gray-800 p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-6 text-purple-400">
          Game Authentication Demo
        </h1>

        <div className="mb-6 text-center">
          {currentUser ? (
            <>
              <p className="text-lg mb-2">
                Logged in as: <span className="font-mono text-green-300 break-all">{userId}</span>
              </p>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <p className="text-lg mb-4">You are currently logged out.</p>
              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
              >
                Log In (Anonymous/Custom Token)
              </button>
            </>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-yellow-300">
          Log in count
        </h2>
        {highScores.length > 0 ? (
          <ul className="space-y-3">
            {highScores.map((score, index) => (
              <li
                key={score.userId}
                className="flex justify-between items-center bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-600"
              >
                <span className="font-semibold text-lg text-blue-200">
                  {index + 1}. <span className="font-mono break-all">{score.userId}</span>
                </span>
                <span className="text-xl font-bold text-green-400">
                  {score.loginCount}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-400">No high scores yet. Log in to start!</p>
        )}
      </div>
    </div>
  );
}

export default App;
