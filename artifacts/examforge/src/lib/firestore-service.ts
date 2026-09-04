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
} from "firebase/firestore";
import { db } from "./firebase";
import { getStoredUsername, saveUsername } from "@/lib/user-identity";

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
  return getStoredUsername();
}

export function setUsername(username: string): void {
  saveUsername(username);
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

// Local storage keys for managing packages created or deleted in this app
const APP_CREATED_PACKAGES_KEY = "examforge_locally_created_packages";
const REMOVED_PACKAGES_KEY = "examforge_locally_removed_packages";
const LOCAL_PACKAGES_STORAGE_KEY = "examforge_local_community_packages";

export function getAppCreatedPackageIds(): Set<string> {
  try {
    const raw = localStorage.getItem(APP_CREATED_PACKAGES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function markPackageCreatedInApp(packageId: string): void {
  const set = getAppCreatedPackageIds();
  set.add(packageId);
  localStorage.setItem(APP_CREATED_PACKAGES_KEY, JSON.stringify(Array.from(set)));
}

export function getLocallyRemovedPackageIds(): Set<string> {
  try {
    const raw = localStorage.getItem(REMOVED_PACKAGES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function markPackageRemovedFromApp(packageId: string): void {
  const set = getLocallyRemovedPackageIds();
  set.add(packageId);
  localStorage.setItem(REMOVED_PACKAGES_KEY, JSON.stringify(Array.from(set)));
}

export function getLocalCommunityPackages(): ExamPackage[] {
  try {
    const raw = localStorage.getItem(LOCAL_PACKAGES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveLocalCommunityPackage(pkg: ExamPackage): void {
  const list = getLocalCommunityPackages().filter((p) => p.id !== pkg.id && p.packageId !== pkg.packageId);
  list.unshift(pkg);
  localStorage.setItem(LOCAL_PACKAGES_STORAGE_KEY, JSON.stringify(list));
  if (pkg.id) markPackageCreatedInApp(pkg.id);
  if (pkg.packageId) markPackageCreatedInApp(pkg.packageId);
}

export function deleteLocalCommunityPackage(packageId: string): void {
  const list = getLocalCommunityPackages().filter((p) => p.id !== packageId && p.packageId !== packageId);
  localStorage.setItem(LOCAL_PACKAGES_STORAGE_KEY, JSON.stringify(list));
}

export function isPackageMadeHere(pkg: ExamPackage): boolean {
  const currentUsername = getStoredUsername();
  const createdIds = getAppCreatedPackageIds();
  if (pkg.id && createdIds.has(pkg.id)) return true;
  if (pkg.packageId && createdIds.has(pkg.packageId)) return true;
  if (currentUsername && pkg.postedByUsername && pkg.postedByUsername.toLowerCase() === currentUsername.toLowerCase()) {
    return true;
  }
  return false;
}

// Package operations
export async function fetchPackages(options?: {
  category?: string;
  courseCode?: string;
  search?: string;
  sortBy?: "newest" | "popular" | "downloads" | "title" | "title_asc" | "title_desc" | "course_asc";
  limit?: number;
}): Promise<ExamPackage[]> {
  let firestorePackages: ExamPackage[] = [];

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

    firestorePackages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ExamPackage[];
  } catch (error: any) {
    console.warn("Firestore fetch error, reading local repository packages:", error);
  }

  // Combine with packages created locally in this app
  const combinedMap = new Map<string, ExamPackage>();

  for (const pkg of firestorePackages) {
    if (pkg.id) combinedMap.set(pkg.id, pkg);
  }

  for (const localPkg of getLocalCommunityPackages()) {
    if (localPkg.id && !combinedMap.has(localPkg.id)) {
      if (!options?.category || options.category === "All" || localPkg.category === options.category) {
        combinedMap.set(localPkg.id, localPkg);
      }
    }
  }

  const removedIds = getLocallyRemovedPackageIds();
  let allPackages = Array.from(combinedMap.values()).filter(
    (p) => !removedIds.has(p.id) && !removedIds.has(p.packageId)
  );

  // Complete removal safety: ensure no hardcoded or sample African Studies questions remain
  allPackages = allPackages.filter((p) => {
    const title = (p.title || "").toLowerCase();
    const code = (p.courseCode || "").toLowerCase();
    const isSampleAfricanStudies = title.includes("african studies") || code.includes("asp 401") || code.includes("asp401");
    return !isSampleAfricanStudies;
  });

  // Course Code categorization criteria filter
  if (options?.courseCode && options.courseCode !== "All") {
    const targetCode = options.courseCode.toLowerCase().trim();
    allPackages = allPackages.filter(
      (p) => p.courseCode && p.courseCode.toLowerCase().trim() === targetCode
    );
  }

  // Client-side search filter
  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    allPackages = allPackages.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        (p.courseCode && p.courseCode.toLowerCase().includes(searchLower)) ||
        (p.institution && p.institution.toLowerCase().includes(searchLower)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchLower)))
    );
  }

  // Sorting
  if (options?.sortBy === "title" || options?.sortBy === "title_asc") {
    allPackages.sort((a, b) => a.title.localeCompare(b.title));
  } else if (options?.sortBy === "title_desc") {
    allPackages.sort((a, b) => b.title.localeCompare(a.title));
  } else if (options?.sortBy === "course_asc") {
    allPackages.sort((a, b) => (a.courseCode || "").localeCompare(b.courseCode || ""));
  } else if (options?.sortBy === "popular") {
    allPackages.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  } else if (options?.sortBy === "downloads") {
    allPackages.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
  } else {
    allPackages.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  }

  if (options?.limit && options.limit > 0) {
    allPackages = allPackages.slice(0, options.limit);
  }

  return allPackages;
}

export async function fetchPackageById(packageId: string): Promise<ExamPackage | null> {
  const removedIds = getLocallyRemovedPackageIds();
  if (removedIds.has(packageId)) {
    return null;
  }

  // Check locally created packages in this app first
  const localMatch = getLocalCommunityPackages().find(
    (p) => p.id === packageId || p.packageId === packageId
  );
  if (localMatch) {
    return localMatch;
  }

  try {
    const docRef = doc(db, PACKAGES_COLLECTION, packageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = {
        id: docSnap.id,
        ...docSnap.data(),
      } as ExamPackage;
      // Guard against sample data
      const title = (data.title || "").toLowerCase();
      const code = (data.courseCode || "").toLowerCase();
      if (title.includes("african studies") || code.includes("asp 401")) {
        return null;
      }
      return data;
    }
  } catch (error: any) {
    console.warn("Firestore fetchPackageById warning:", error);
  }

  return null;
}

export async function deletePackage(packageId: string): Promise<void> {
  // Always remove from this app's storage and track as removed
  markPackageRemovedFromApp(packageId);
  deleteLocalCommunityPackage(packageId);

  // Attempt to delete from Firestore if it was created in this app
  try {
    const docRef = doc(db, PACKAGES_COLLECTION, packageId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.warn("Firestore deletePackage info:", error?.message || error);
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
