# **App Name**: BalanceHub

## Core Features:

- User Authentication: Secure user registration and login functionality using Firebase Authentication to manage user access and roles (admin/user).
- Group Management: Create new debt groups with an admin, assign group names, set types ('fixed' or 'variable'), and generate unique invite links for member invitations. Group data is stored in Firestore's 'groups' collection.
- Debt Creation & Tracking: Users can add new debts within a specific group, specifying the debtor (userId), amount, and initial status ('pending'). Debts are stored in the 'debts' Firestore collection.
- Debt Status Updates: Group administrators can update the status of individual debts to 'under_review' or 'paid' to reflect the current settlement process.
- Member Invitation System: Facilitate inviting members to a group via a shareable, unique link, simplifying group collaboration and user onboarding.
- Role-Based Data Access: Implement access control based on user roles (admin/user) to ensure appropriate permissions for managing groups and debts within the application, utilizing user roles stored in the 'users' Firestore collection.
- AI Debt Summarizer Tool: Utilize an AI tool to analyze all debts within a group and provide a concise summary, highlighting total owed, individual contributions, and suggested settlements.

## Style Guidelines:

- Primary color: A deep, professional blue (#283466) for key elements and branding.
- Background color: A clean, very light grey (#F1F3F4) to provide a neutral canvas.
- Accent color: A vibrant orange-red (#EA675A) for calls to action, alerts, and important interactive elements.
- Secondary color: A muted blue-green (#769DA9) for subtle highlights and complementary information.
- Text and dark elements: A dark grey (#323531) for body text, icons, and borders to ensure readability and contrast.
- Headline font: 'Space Grotesk' (sans-serif) for a modern, structured, and tech-forward feel that commands attention.
- Body font: 'Inter' (sans-serif) for excellent readability, neutrality, and clear presentation of financial data and details.
- Utilize simple, outline-style icons that visually represent financial concepts, user interactions, and group dynamics without being overly complex.
- Adopt a clean, grid-based layout with generous white space to enhance readability and make complex debt information easy to digest.
- Incorporate subtle transitions and fades for loading states and status changes to provide a smooth and reassuring user experience.