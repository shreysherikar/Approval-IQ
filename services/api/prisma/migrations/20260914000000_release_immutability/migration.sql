-- Phase 1 exit criterion: "Historical release records are immutable."
-- Enforcement lives at the persistence boundary so it holds regardless of
-- which client path (importer, API, psql, future admin UI) attempts the write.
-- Draft releases remain fully editable; only rows tied to a PUBLISHED release
-- are frozen. Phase 13 will add the formal draft/review/publish state machine;
-- these triggers are the Phase 1 immutability floor, not the final workflow.

-- 1. The release row itself: once published, no UPDATE and no DELETE.
CREATE OR REPLACE FUNCTION prevent_published_release_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'KnowledgeRelease % is published and immutable (version=%)', OLD.id, OLD.version
      USING ERRCODE = '25001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_releases_immutable ON "knowledge_releases";
CREATE TRIGGER trg_knowledge_releases_immutable
  BEFORE UPDATE OR DELETE ON "knowledge_releases"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_release_mutation();

-- 2. Approval definitions tied (release_id) to a published release are frozen.
CREATE OR REPLACE FUNCTION prevent_published_approval_mutation()
RETURNS trigger AS $$
DECLARE
  rel_status "KnowledgeReleaseStatus";
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT status INTO rel_status FROM "knowledge_releases" WHERE id = OLD.release_id;
    IF rel_status = 'published' THEN
      RAISE EXCEPTION 'ApprovalDefinition % belongs to published release % and is immutable', OLD.id, OLD.release_id
        USING ERRCODE = '25001';
    END IF;
    IF NEW.release_id IS DISTINCT FROM OLD.release_id THEN
      SELECT status INTO rel_status FROM "knowledge_releases" WHERE id = NEW.release_id;
      IF rel_status = 'published' THEN
        RAISE EXCEPTION 'Cannot move ApprovalDefinition % into published release %', OLD.id, NEW.release_id
          USING ERRCODE = '25001';
      END IF;
    END IF;
    RETURN NEW;
  ELSE
    SELECT status INTO rel_status FROM "knowledge_releases" WHERE id = OLD.release_id;
    IF rel_status = 'published' THEN
      RAISE EXCEPTION 'ApprovalDefinition % belongs to published release % and cannot be deleted', OLD.id, OLD.release_id
        USING ERRCODE = '25001';
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_approval_definitions_immutable ON "approval_definitions";
CREATE TRIGGER trg_approval_definitions_immutable
  BEFORE UPDATE OR DELETE ON "approval_definitions"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_approval_mutation();

-- 3. Dependencies are frozen when EITHER endpoint approval sits in a published
-- release (approvals carry the release link, so reachability is transitive).
CREATE OR REPLACE FUNCTION prevent_published_dependency_mutation()
RETURNS trigger AS $$
DECLARE
  from_rel TEXT;
  to_rel TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT kr.status::TEXT INTO from_rel FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = NEW.from_approval_id;
    SELECT kr.status::TEXT INTO to_rel FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = NEW.to_approval_id;
    IF from_rel = 'published' OR to_rel = 'published' THEN
      RAISE EXCEPTION 'Cannot add a dependency touching a published release (from=% to=%)', NEW.from_approval_id, NEW.to_approval_id
        USING ERRCODE = '25001';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT kr.status::TEXT INTO from_rel FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = OLD.from_approval_id;
    SELECT kr.status::TEXT INTO to_rel FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = OLD.to_approval_id;
    IF from_rel = 'published' OR to_rel = 'published' THEN
      RAISE EXCEPTION 'Dependency % touches a published release and is immutable', OLD.id
        USING ERRCODE = '25001';
    END IF;
    RETURN NEW;
  ELSE
    SELECT kr.status::TEXT INTO from_rel FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = OLD.from_approval_id;
    SELECT kr.status::TEXT INTO to_rel FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = OLD.to_approval_id;
    IF from_rel = 'published' OR to_rel = 'published' THEN
      RAISE EXCEPTION 'Dependency % touches a published release and cannot be deleted', OLD.id
        USING ERRCODE = '25001';
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dependencies_immutable ON "dependencies";
CREATE TRIGGER trg_dependencies_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "dependencies"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_dependency_mutation();

-- 4. Approval↔document links are frozen when the parent approval is published.
CREATE OR REPLACE FUNCTION prevent_published_requirement_mutation()
RETURNS trigger AS $$
DECLARE
  rel_status TEXT;
  approval_col TEXT;
BEGIN
  approval_col := CASE WHEN TG_OP = 'DELETE' THEN OLD.approval_definition_id ELSE NEW.approval_definition_id END;
  SELECT kr.status::TEXT INTO rel_status FROM "approval_definitions" ad JOIN "knowledge_releases" kr ON kr.id = ad.release_id WHERE ad.id = approval_col;
  IF rel_status = 'published' THEN
    RAISE EXCEPTION 'ApprovalDocumentRequirement for approval % belongs to a published release and is immutable', approval_col
      USING ERRCODE = '25001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_approval_document_requirements_immutable ON "approval_document_requirements";
CREATE TRIGGER trg_approval_document_requirements_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON "approval_document_requirements"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_requirement_mutation();
