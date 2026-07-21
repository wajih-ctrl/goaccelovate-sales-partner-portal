-- Publish the confirmed Welcome Kit introduction video.

insert into public.settings (key, value, description)
values (
  'welcome_intro_video_url',
  '"https://youtu.be/RaHdE6QYr98?si=9ZyHGdKMQ8gICvvr"'::jsonb,
  'Welcome Kit introduction video by the VP of Global Client Relations'
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;
