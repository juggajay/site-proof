-- H9: persist the client approval reference recorded when a major NCR is
-- closed by concession (previously collected by the UI and silently dropped).
ALTER TABLE "ncrs" ADD COLUMN "client_approval_reference" TEXT;
