### Fake unapply the migration

python manage.py migrate pipelines zero --fake


### Delete any old migration records from DB (optional, only if step 1 fails)
python manage.py dbshell
DELETE FROM django_migrations WHERE app = 'pipelines';


### Re-apply migrations

python manage.py migrate pipelines



### Shell commands to drop tables

```
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'pipelines_%'
    """)
    tables = cursor.fetchall()
    for (table_name,) in tables:
        print(f"Dropping table: {table_name}")
        cursor.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
```

