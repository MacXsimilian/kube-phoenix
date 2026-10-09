-- For deployments with AUTO_MIGRATE=false. Additive and safe to rerun.
-- Empty values explicitly identify legacy records; never invent their UID.
ALTER TABLE workload_snapshots
    ADD COLUMN IF NOT EXISTS workload_uid varchar(128) DEFAULT '',
    ADD COLUMN IF NOT EXISTS phase varchar(20) DEFAULT '';
