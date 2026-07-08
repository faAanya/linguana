import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
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
