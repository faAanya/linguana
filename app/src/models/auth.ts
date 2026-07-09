import { ObjectId } from "mongodb";
 
export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  emailVerified: boolean;
  learningLanguages: string[];  // ISO codes user wants to learn, e.g. ["es", "fr"]
  nativeLanguages: string[];    // ISO codes user already knows, e.g. ["en"]
  createdAt: Date;
  updatedAt: Date;
}
 
// Verification code record (new collection)
export interface VerificationCode {
  _id?: ObjectId;
  email: string;
  codeHash: string;
  name?: string | null;
  mode: "register" | "login";
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}
 
// JWT payload shape — what gets encoded in the token
export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
}

// Safe user shape returned to the client — never includes passwordHash
export interface PublicUser {
  id: string;
  email: string;
  name: string;
}
