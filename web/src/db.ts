import type { PracticeDocument } from "./models";

const DATABASE_NAME = "genkou-youshi";
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = "practice-documents";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        database.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local library."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local library operation failed."));
  });
}

export async function loadDocuments(): Promise<PracticeDocument[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DOCUMENT_STORE, "readonly");
    const documents = await requestResult(
      transaction.objectStore(DOCUMENT_STORE).getAll() as IDBRequest<
        PracticeDocument[]
      >,
    );
    return documents.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  } finally {
    database.close();
  }
}

export async function saveDocument(document: PracticeDocument): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(
      database
        .transaction(DOCUMENT_STORE, "readwrite")
        .objectStore(DOCUMENT_STORE)
        .put(document),
    );
  } finally {
    database.close();
  }
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(
      database
        .transaction(DOCUMENT_STORE, "readwrite")
        .objectStore(DOCUMENT_STORE)
        .delete(id),
    );
  } finally {
    database.close();
  }
}
