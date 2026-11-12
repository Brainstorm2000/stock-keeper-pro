DO $migration$
DECLARE
  foreign_key record;
  has_covering_index boolean;
  index_name text;
  quoted_columns text;
BEGIN
  FOR foreign_key IN
    SELECT
      constraint_row.conrelid AS table_oid,
      table_schema.nspname AS schema_name,
      table_row.relname AS table_name,
      constraint_row.conname AS constraint_name,
      array_agg(attribute_row.attname ORDER BY key_column.ordinality) AS column_names,
      array_agg(attribute_row.attnum::smallint ORDER BY key_column.ordinality) AS column_numbers
    FROM pg_constraint constraint_row
    JOIN pg_class table_row
      ON table_row.oid = constraint_row.conrelid
    JOIN pg_namespace table_schema
      ON table_schema.oid = table_row.relnamespace
    JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY
      AS key_column(attnum, ordinality) ON true
    JOIN pg_attribute attribute_row
      ON attribute_row.attrelid = table_row.oid
      AND attribute_row.attnum = key_column.attnum
      AND NOT attribute_row.attisdropped
    WHERE constraint_row.contype = 'f'
      AND table_schema.nspname = 'public'
      AND table_row.relkind IN ('r', 'p')
    GROUP BY
      constraint_row.conrelid,
      table_schema.nspname,
      table_row.relname,
      constraint_row.conname
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_index index_row
      WHERE index_row.indrelid = foreign_key.table_oid
        AND index_row.indisvalid
        AND index_row.indisready
        AND index_row.indpred IS NULL
        AND index_row.indexprs IS NULL
        AND (
          SELECT array_agg(index_column.attnum ORDER BY index_column.ordinality)
          FROM unnest(index_row.indkey::smallint[]) WITH ORDINALITY
            AS index_column(attnum, ordinality)
          WHERE index_column.ordinality <= cardinality(foreign_key.column_numbers)
        ) = foreign_key.column_numbers
    )
    INTO has_covering_index;

    IF NOT has_covering_index THEN
      index_name := left(
        format(
          'idx_fk_%s_%s_%s',
          foreign_key.table_name,
          foreign_key.column_names[1],
          substr(md5(foreign_key.table_name || ':' || foreign_key.constraint_name), 1, 8)
        ),
        63
      );

      SELECT string_agg(format('%I', column_name), ', ')
      INTO quoted_columns
      FROM unnest(foreign_key.column_names) AS columns(column_name);

      EXECUTE format(
        'CREATE INDEX %I ON %I.%I (%s)',
        index_name,
        foreign_key.schema_name,
        foreign_key.table_name,
        quoted_columns
      );
      RAISE NOTICE 'Created index % on %.%(%)',
        index_name,
        foreign_key.schema_name,
        foreign_key.table_name,
        quoted_columns;
    END IF;
  END LOOP;
END;
$migration$;