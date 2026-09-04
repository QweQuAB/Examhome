import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Types
export interface ExamPackage {
  id: string;
  packageId: string;
  formatIdentifier: string;
  schemaVersion: number;
  title: string;
  courseCode: string | null;
  institution: string | null;
  description: string | null;
  category: string;
  author: string;
  authorRole: string;
  postedByUsername: string;
  tags: string[];
  exportedAt: number;
  postedAt: number;
  likeCount: number;
  downloadCount: number;
  mcqQuestions: any[];
  essayQuestions: any[];
}

export interface PackageComment {
  id: string;
  packageId: string;
  username: string;
  content: string;
  createdAt: number;
  likeCount: number;
}

export interface PackageReport {
  id: string;
  packageId: string;
  packageTitle: string;
  author: string;
  category: string;
  reason: string;
  reasonLabel: string;
  details: string;
  reportedBy: string;
  status: string;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

const PACKAGES_COLLECTION = "exam_packages";
const COMMENTS_COLLECTION = "package_comments";
const REPORTS_COLLECTION = "package_reports";

// Username management
export function getUsername(): string {
  return localStorage.getItem("examforge_username") || "";
}

export function setUsername(username: string): void {
  localStorage.setItem("examforge_username", username);
}

// Comment likes persistence
export function getLikedComments(): Set<string> {
  try {
    const stored = localStorage.getItem("liked_comments");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function toggleLikedComment(commentId: string): void {
  const liked = getLikedComments();
  if (liked.has(commentId)) {
    liked.delete(commentId);
  } else {
    liked.add(commentId);
  }
  localStorage.setItem("liked_comments", JSON.stringify(Array.from(liked)));
}

export function isCommentLiked(commentId: string): boolean {
  return getLikedComments().has(commentId);
}

// Package operations
export async function fetchPackages(options?: {
  category?: string;
  search?: string;
  sortBy?: "newest" | "popular" | "downloads";
  limit?: number;
}): Promise<ExamPackage[]> {
  try {
    const constraints: any[] = [];

    if (options?.category && options.category !== "All") {
      constraints.push(where("category", "==", options.category));
    }

    if (options?.sortBy === "popular") {
      constraints.push(orderBy("likeCount", "desc"));
    } else if (options?.sortBy === "downloads") {
      constraints.push(orderBy("downloadCount", "desc"));
    } else {
      constraints.push(orderBy("postedAt", "desc"));
    }

    if (options?.limit) {
      constraints.push(firestoreLimit(options.limit));
    }

    const q = query(collection(db, PACKAGES_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    let packages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ExamPackage[];

    // Client-side search filter
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      packages = packages.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          (p.courseCode && p.courseCode.toLowerCase().includes(searchLower)) ||
          (p.institution && p.institution.toLowerCase().includes(searchLower))
      );
    }

    return packages;
  } catch (error: any) {
    console.error("Failed to fetch packages:", error);
    throw new Error(error.message || "Failed to load packages");
  }
}

export async function fetchPackageById(packageId: string): Promise<ExamPackage | null> {
  try {
    const docRef = doc(db, PACKAGES_COLLECTION, packageId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as ExamPackage;
  } catch (error: any) {
    console.error("Failed to fetch package:", error);
    throw new Error(error.message || "Failed to load package");
  }
}

export async function likePackage(packageId: string): Promise<void> {
  try {
    const docRef = doc(db, PACKAGES_COLLECTION, packageId);
    await updateDoc(docRef, {
      likeCount: increment(1),
    });
  } catch (error: any) {
    console.error("Failed to like package:", error);
    throw new Error(error.message || "Failed to like package");
  }
}

export async function incrementDownloadCount(packageId: string): Promise<void> {
  try {
    const docRef = doc(db, PACKAGES_COLLECTION, packageId);
    await updateDoc(docRef, {
      downloadCount: increment(1),
    });
  } catch (error: any) {
    console.error("Failed to increment download count:", error);
    throw new Error(error.message || "Failed to track download");
  }
}

export async function publishPackage(
  packageData: Omit<ExamPackage, "id" | "likeCount" | "downloadCount">
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, PACKAGES_COLLECTION), {
      ...packageData,
      likeCount: 0,
      downloadCount: 0,
    });
    return docRef.id;
  } catch (error: any) {
    console.error("Failed to publish package:", error);
    throw new Error(error.message || "Failed to publish package");
  }
}

// Comment operations
export async function fetchComments(packageId: string): Promise<PackageComment[]> {
  try {
    const q = query(
      collection(db, COMMENTS_COLLECTION),
      where("packageId", "==", packageId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PackageComment[];
  } catch (error: any) {
    console.error("Failed to fetch comments:", error);
    throw new Error(error.message || "Failed to load comments");
  }
}

export async function addComment(
  packageId: string,
  content: string
): Promise<string> {
  const username = getUsername();
  if (!username) {
    throw new Error("Please set your username first");
  }

  try {
    const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), {
      packageId,
      username,
      content,
      createdAt: Date.now(),
      likeCount: 0,
    });
    return docRef.id;
  } catch (error: any) {
    console.error("Failed to add comment:", error);
    throw new Error(error.message || "Failed to post comment");
  }
}

export async function likeComment(commentId: string): Promise<void> {
  try {
    const docRef = doc(db, COMMENTS_COLLECTION, commentId);
    await updateDoc(docRef, {
      likeCount: increment(1),
    });
  } catch (error: any) {
    console.error("Failed to like comment:", error);
    throw new Error(error.message || "Failed to like comment");
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COMMENTS_COLLECTION, commentId));
  } catch (error: any) {
    console.error("Failed to delete comment:", error);
    throw new Error(error.message || "Failed to delete comment");
  }
}

// Report operations
export async function submitReport(
  report: Omit<PackageReport, "id" | "status" | "createdAt">
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), {
      ...report,
      status: "pending",
      createdAt: Date.now(),
    });
    return docRef.id;
  } catch (error: any) {
    console.error("Failed to submit report:", error);
    throw new Error(error.message || "Failed to submit report");
  }
}

// Categories
export const CATEGORIES = [
  "General",
  "Computer Science",
  "Engineering",
  "Medicine",
  "Law",
  "Business",
  "Sciences",
  "Arts",
  "Education",
  "Other",
];
