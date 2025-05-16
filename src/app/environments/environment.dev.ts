export const environment = {
	"projectId": import.meta.env.NG_APP_DEV_PROJECT_ID,
	"appId": import.meta.env.NG_APP_DEV_APP_ID,
	"storageBucket": import.meta.env.NG_APP_DEV_STORAGE_BUCKET,
	"apiKey": import.meta.env.NG_APP_DEV_API_KEY,
	"authDomain": import.meta.env.NG_APP_DEV_AUTH_DOMAIN,
	"messagingSenderId": import.meta.env.NG_APP_DEV_MESSAGING_SENDER_ID,
  "firestoreUseLocal": true,
  "firebaseStorageUseLocal": true,
  "firebaseAuthUseLocal": true,
  "authRequired": true,
  "databaseId": "default",
  "authorizedUids": [import.meta.env.NG_APP_DEV_AUTHORIZED_UID],
};
