alter type public.induction_module_status add value if not exists 'uploaded';
alter type public.induction_module_status add value if not exists 'processing';
alter type public.induction_module_status add value if not exists 'review_required';
alter type public.induction_module_status add value if not exists 'generation_failed';
