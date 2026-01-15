-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contest_settings table for dynamic countdown date
CREATE TABLE public.contest_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_name TEXT NOT NULL DEFAULT 'Little Stars Contest',
  contest_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  contest_end_date TIMESTAMP WITH TIME ZONE,
  vote_price INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contestants table
CREATE TABLE public.contestants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  profile_image TEXT,
  gallery_images TEXT[] DEFAULT '{}',
  votes INTEGER NOT NULL DEFAULT 0,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create votes table for tracking vote transactions
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contestant_id UUID NOT NULL REFERENCES public.contestants(id) ON DELETE CASCADE,
  voter_email TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 1,
  amount_paid INTEGER NOT NULL,
  payment_reference TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Contest settings policies (public read, admin write)
CREATE POLICY "Anyone can view contest settings"
  ON public.contest_settings FOR SELECT
  USING (true);

-- Contestants policies
CREATE POLICY "Parents can view their own contestants"
  ON public.contestants FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Anyone can view approved contestants"
  ON public.contestants FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Parents can insert their own contestants"
  ON public.contestants FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update their own contestants"
  ON public.contestants FOR UPDATE
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete their own contestants"
  ON public.contestants FOR DELETE
  USING (auth.uid() = parent_id);

-- Votes policies
CREATE POLICY "Anyone can insert votes"
  ON public.votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view votes"
  ON public.votes FOR SELECT
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contest_settings_updated_at
  BEFORE UPDATE ON public.contest_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contestants_updated_at
  BEFORE UPDATE ON public.contestants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default contest settings
INSERT INTO public.contest_settings (contest_name, contest_start_date, vote_price)
VALUES ('Little Stars Contest', now() + interval '30 days', 50);