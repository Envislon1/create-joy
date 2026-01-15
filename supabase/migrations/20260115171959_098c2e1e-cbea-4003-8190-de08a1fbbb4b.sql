-- Create contestants table
CREATE TABLE public.contestants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 12),
  sex TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  profile_image TEXT,
  gallery_images TEXT[] DEFAULT '{}',
  votes INTEGER NOT NULL DEFAULT 0,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contest_settings table
CREATE TABLE public.contest_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_name TEXT NOT NULL DEFAULT 'Little Stars Contest',
  contest_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  contest_end_date TIMESTAMP WITH TIME ZONE,
  vote_price INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_settings ENABLE ROW LEVEL SECURITY;

-- Contestants policies
CREATE POLICY "Anyone can view approved contestants"
  ON public.contestants FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Parents can view their own contestants"
  ON public.contestants FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Authenticated users can register contestants"
  ON public.contestants FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update their own contestants"
  ON public.contestants FOR UPDATE
  USING (auth.uid() = parent_id);

-- Contest settings policies (public read)
CREATE POLICY "Anyone can view contest settings"
  ON public.contest_settings FOR SELECT
  USING (true);

-- Insert default contest settings
INSERT INTO public.contest_settings (contest_name, contest_start_date, vote_price, is_active)
VALUES ('Little Stars Contest', now() + interval '30 days', 50, true);