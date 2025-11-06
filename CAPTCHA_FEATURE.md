# CAPTCHA Feature Documentation

## Overview
A visual CAPTCHA component has been added to the Login screen to prevent automated bot attacks and enhance security.

## Features

### 1. Visual CAPTCHA Generation
- **Location**: [src/components/Captcha.tsx](src/components/Captcha.tsx)
- Generates random 6-character alphanumeric codes (excluding confusing characters like O, 0, I, 1)
- Uses SVG rendering for better visual quality
- Includes noise lines and random positioning to prevent OCR attacks

### 2. Visual Effects
- Random character rotation (-12.5° to +12.5°)
- Multiple colored characters for better security
- Background noise lines
- Dot patterns for additional complexity
- Gradient background

### 3. User-Friendly Features
- **Refresh Button**: Users can generate a new CAPTCHA if the current one is hard to read
- **Real-time Validation**: Visual feedback (green checkmark for correct, red X for incorrect)
- **Case Insensitive**: Users can enter uppercase or lowercase characters
- **Clear Instructions**: Helpful hint text below the input field
- **Visual States**: Input border changes color based on validation state

### 4. Security Integration
- **Login Validation**: [Login.tsx:131-135](src/Login.tsx#L131-L135)
- CAPTCHA must be correctly entered before login is allowed
- Prevents brute force attacks
- CAPTCHA is cleared after successful login

## Implementation Details

### Components Created
1. **Captcha.tsx** - Main CAPTCHA component
   - SVG-based rendering
   - Auto-validation on input change
   - Refresh functionality

### Integration Points
1. **Login.tsx** - CAPTCHA added to login form
   - State management for CAPTCHA value and validation
   - Validation check before Firebase authentication
   - Clear CAPTCHA on successful login

### Dependencies Added
- `react-native-svg@15.1.0` - For SVG rendering

## Usage

The CAPTCHA is automatically displayed on the Login screen. Users must:
1. View the generated CAPTCHA image
2. Enter the 6 characters shown
3. Click the refresh button if the CAPTCHA is unclear
4. Complete other login fields
5. Submit the form

## User Experience Flow

```
1. User opens Login screen
2. CAPTCHA is automatically generated and displayed
3. User enters email, password, and CAPTCHA code
4. System validates CAPTCHA in real-time
   - ✅ Green checkmark if correct
   - ❌ Red X if incorrect
5. User clicks "Đăng nhập"
6. If CAPTCHA is incorrect, show error alert
7. If CAPTCHA is correct, proceed with login
8. After successful login, CAPTCHA is cleared
```

## Security Benefits

1. **Bot Prevention**: Automated scripts cannot easily read the distorted text
2. **Brute Force Protection**: Adds extra layer beyond email/password
3. **Visual Obfuscation**: Noise lines and rotation make OCR difficult
4. **Session Security**: Each login attempt requires new CAPTCHA validation

## Future Enhancements (Optional)

- Add audio CAPTCHA for accessibility
- Implement progressive difficulty (harder CAPTCHA after failed attempts)
- Add time-based expiration for CAPTCHA codes
- Track failed CAPTCHA attempts
- Consider Firebase reCAPTCHA for production use

## Testing

To test the CAPTCHA feature:
1. Start the app: `npm start`
2. Navigate to Login screen
3. Try entering incorrect CAPTCHA code - should see red X and error on submit
4. Enter correct CAPTCHA code - should see green checkmark
5. Click refresh button - should generate new CAPTCHA
6. Complete login with correct CAPTCHA - should succeed

## Files Modified

- [src/Login.tsx](src/Login.tsx) - Added CAPTCHA integration
- [src/components/Captcha.tsx](src/components/Captcha.tsx) - New CAPTCHA component
- [package.json](package.json) - Added react-native-svg dependency

## Notes

- CAPTCHA is case-insensitive for better user experience
- Characters that look similar (O/0, I/1, etc.) are excluded to reduce confusion
- SVG-based rendering ensures crisp display on all screen sizes
- Component is reusable and can be added to other screens (Register, Forgot Password, etc.)
