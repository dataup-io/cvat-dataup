# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import django_rq
from django.conf import settings
from django.core.management.base import BaseCommand
from rq.job import Job as RQJob


class Command(BaseCommand):
    help = "Check the status of the recompute_job_overviews periodic job"

    def add_arguments(self, parser):
        parser.add_argument(
            "--job-id",
            type=str,
            default="recompute_job_overviews",
            help="Job ID to check (default: recompute_job_overviews)",
        )

    def handle(self, *args, **options):
        job_id = options["job_id"]
        queue_name = settings.CVAT_QUEUES.LENS.value

        self.stdout.write(f"\n=== Checking LENS Queue: {queue_name} ===\n")

        # Get queue and scheduler
        queue = django_rq.get_queue(queue_name)
        scheduler = django_rq.get_scheduler(queue_name, queue=queue)

        # Check scheduled periodic jobs
        self.stdout.write("1. Scheduled Periodic Jobs:")
        scheduled_jobs = scheduler.get_jobs()
        found_scheduled = False
        for job in scheduled_jobs:
            if job.id == job_id:
                found_scheduled = True
                self.stdout.write(
                    self.style.SUCCESS(f"   ✓ Found scheduled job: {job.id}")
                )
                self.stdout.write(f"     - Function: {job.func_name}")
                self.stdout.write(f"     - Cron: {job.meta.get('cron_string', 'N/A')}")
                if hasattr(job, "scheduled_time") and job.scheduled_time:
                    self.stdout.write(f"     - Next run: {job.scheduled_time}")
                self.stdout.write(f"     - Status: {job.get_status()}")

        if not found_scheduled:
            self.stdout.write(
                self.style.WARNING(f"   ✗ Job '{job_id}' not found in scheduled jobs")
            )

        # Check if the job exists in the queue
        self.stdout.write(f"\n2. Job in Queue (ID: {job_id}):")
        job = queue.fetch_job(job_id)
        if job:
            self.stdout.write(self.style.SUCCESS(f"   ✓ Job found: {job.id}"))
            self.stdout.write(f"     - Status: {job.get_status()}")
            if job.created_at:
                self.stdout.write(f"     - Created: {job.created_at}")
            if job.started_at:
                self.stdout.write(f"     - Started: {job.started_at}")
            if job.ended_at:
                self.stdout.write(f"     - Ended: {job.ended_at}")
            if job.is_finished:
                result = job.return_value()
                self.stdout.write(f"     - Result: {result if result else 'None'}")
            if job.is_failed:
                self.stdout.write(
                    self.style.ERROR(f"     - Error: {job.exc_info}")
                )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "   ✗ Job not found in queue (may be scheduled only)"
                )
            )

        # Check currently running jobs
        self.stdout.write("\n3. Currently Running Jobs:")
        started_jobs = queue.started_job_registry.get_job_ids()
        if started_jobs:
            self.stdout.write(f"   Running jobs: {len(started_jobs)}")
            for started_job_id in started_jobs[:10]:
                started_job = queue.fetch_job(started_job_id)
                if started_job:
                    marker = "✓" if job_id in started_job_id else "-"
                    self.stdout.write(
                        f"   {marker} {started_job_id}: {started_job.get_status()}"
                    )
        else:
            self.stdout.write("   No jobs currently running")

        # Check recent finished jobs
        self.stdout.write("\n4. Recent Finished Jobs (last 10):")
        finished_jobs = queue.finished_job_registry.get_job_ids()
        if finished_jobs:
            self.stdout.write(f"   Total finished: {len(finished_jobs)}")
            for finished_job_id in finished_jobs[:10]:
                finished_job = queue.fetch_job(finished_job_id)
                if finished_job and job_id in finished_job_id:
                    self.stdout.write(
                        f"   ✓ {finished_job_id}: Finished at {finished_job.ended_at}"
                    )
        else:
            self.stdout.write("   No finished jobs found")

        # Check failed jobs
        self.stdout.write("\n5. Recent Failed Jobs (last 10):")
        failed_jobs = queue.failed_job_registry.get_job_ids()
        if failed_jobs:
            self.stdout.write(f"   Total failed: {len(failed_jobs)}")
            for failed_job_id in failed_jobs[:10]:
                failed_job = queue.fetch_job(failed_job_id)
                if failed_job and job_id in failed_job_id:
                    self.stdout.write(
                        self.style.ERROR(
                            f"   ✗ {failed_job_id}: {failed_job.exc_info}"
                        )
                    )
        else:
            self.stdout.write("   No failed jobs found")

        self.stdout.write("\n=== Done ===\n")





