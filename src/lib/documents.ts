import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'southamerica-east1');

export const getDocumentDownloadUrl = async (documentId: string, portalToken?: string) => {
  const callable = httpsCallable<{ documentId: string; portalToken?: string }, { downloadUrl: string; expiresAt: string }>(functions, 'getDocumentDownloadUrl');
  return (await callable({ documentId, portalToken })).data;
};

export interface DocumentUploadRequest {
  leadId: string;
  fileName: string;
  contentType: string;
  size: number;
  category: string;
  visibleInPortal: boolean;
}

export const createDocumentUpload = async (input: DocumentUploadRequest) => {
  const callable = httpsCallable<DocumentUploadRequest, { uploadId: string; uploadUrl: string; expiresAt: string }>(functions, 'createDocumentUpload');
  return (await callable(input)).data;
};

export const finalizeDocumentUpload = async (uploadId: string) => {
  const callable = httpsCallable<{ uploadId: string }, { documentId: string }>(functions, 'finalizeDocumentUpload');
  return (await callable({ uploadId })).data;
};
