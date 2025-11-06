# Family Budget Expo App

This is a React Native application built with Expo for managing family budgets.

## Features

### Authentication System

The app provides a complete authentication system with the following features:

1. **Email/Password Registration**

   - Users can create accounts using email and password
   - Password strength validation
   - Password confirmation matching

2. **Google OAuth Login**

   - One-tap sign-in with Google accounts
   - Secure authentication using expo-auth-session
   - Support for Android, iOS, and web platforms

3. **Profile Management**

   - Update display name and profile picture
   - Change password with current password verification
   - Account deletion with data removal

4. **Security Features**
   - Firebase Authentication backend
   - Password hashing handled by Firebase
   - Secure token storage
   - Re-authentication required for sensitive operations

## Setup Instructions

### Prerequisites

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure Environment Variables

   - Update the `.env` file with your Firebase configuration
   - Add Google OAuth client IDs for each platform

3. Start the app

   ```bash
   npx expo start
   ```

### Google OAuth Configuration

To enable Google authentication, you need to:

1. Create a project in the Google Cloud Console
2. Configure OAuth consent screen
3. Create OAuth 2.0 credentials for each platform:
   - Android
   - iOS
   - Web
4. Add the client IDs to your `.env` file:

```
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=your_expo_client_id
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
