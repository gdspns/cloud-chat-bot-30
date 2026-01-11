CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: validate_bot_expiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_bot_expiry() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    IF NEW.expire_at IS NOT NULL AND NEW.expire_at < now() THEN
        NEW.is_active = false;
    END IF;
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activation_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activation_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    expire_at timestamp with time zone,
    is_used boolean DEFAULT false,
    used_by_bot_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    validity_days integer DEFAULT 30,
    feature_type text DEFAULT 'both'::text NOT NULL
);


--
-- Name: bot_activations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_activations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bot_token text NOT NULL,
    personal_user_id text NOT NULL,
    greeting_message text DEFAULT '你好！👋 有什么可以帮助你的吗？'::text,
    activation_code text NOT NULL,
    is_active boolean DEFAULT false,
    is_authorized boolean DEFAULT false,
    trial_messages_used integer DEFAULT 0,
    trial_limit integer DEFAULT 20,
    expire_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    web_enabled boolean DEFAULT true,
    app_enabled boolean DEFAULT true,
    user_id uuid,
    keyboard_menu_first_used_at timestamp with time zone,
    keyboard_expire_at timestamp with time zone
);


--
-- Name: bot_trial_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_trial_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bot_token text NOT NULL,
    messages_used integer DEFAULT 0,
    is_blocked boolean DEFAULT false,
    was_authorized boolean DEFAULT false,
    last_authorized_expire_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bot_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bot_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bot_token text NOT NULL,
    telegram_user_id bigint NOT NULL,
    first_name text NOT NULL,
    last_name text,
    username text,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: disabled_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disabled_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    disabled_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled_by uuid,
    reason text
);


--
-- Name: keyboard_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.keyboard_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bot_token text NOT NULL,
    bot_username text,
    bot_first_name text,
    commands jsonb DEFAULT '[]'::jsonb,
    reply_keyboard jsonb DEFAULT '[]'::jsonb,
    auto_reply_rules jsonb DEFAULT '[]'::jsonb,
    flow_messages jsonb DEFAULT '[]'::jsonb,
    force_menu_on_start boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activity_log_enabled boolean DEFAULT true,
    bilingual_button_enabled boolean DEFAULT false,
    user_language_preferences jsonb DEFAULT '{}'::jsonb,
    auto_cleanup_enabled boolean DEFAULT false,
    auto_cleanup_days integer DEFAULT 0,
    last_cleanup_at timestamp with time zone,
    menu_admin_chat_id bigint,
    keyboard_trial_started_at timestamp with time zone,
    keyboard_expire_at timestamp with time zone
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bot_activation_id uuid NOT NULL,
    telegram_chat_id bigint NOT NULL,
    telegram_user_name text,
    telegram_message_id bigint,
    content text NOT NULL,
    direction text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_admin_reply boolean DEFAULT false,
    CONSTRAINT messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activation_codes activation_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_code_key UNIQUE (code);


--
-- Name: activation_codes activation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_pkey PRIMARY KEY (id);


--
-- Name: bot_activations bot_activations_activation_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_activations
    ADD CONSTRAINT bot_activations_activation_code_key UNIQUE (activation_code);


--
-- Name: bot_activations bot_activations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_activations
    ADD CONSTRAINT bot_activations_pkey PRIMARY KEY (id);


--
-- Name: bot_trial_records bot_trial_records_bot_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_trial_records
    ADD CONSTRAINT bot_trial_records_bot_token_key UNIQUE (bot_token);


--
-- Name: bot_trial_records bot_trial_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_trial_records
    ADD CONSTRAINT bot_trial_records_pkey PRIMARY KEY (id);


--
-- Name: bot_users bot_users_bot_token_telegram_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_users
    ADD CONSTRAINT bot_users_bot_token_telegram_user_id_key UNIQUE (bot_token, telegram_user_id);


--
-- Name: bot_users bot_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_users
    ADD CONSTRAINT bot_users_pkey PRIMARY KEY (id);


--
-- Name: disabled_users disabled_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disabled_users
    ADD CONSTRAINT disabled_users_pkey PRIMARY KEY (id);


--
-- Name: disabled_users disabled_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disabled_users
    ADD CONSTRAINT disabled_users_user_id_key UNIQUE (user_id);


--
-- Name: keyboard_configs keyboard_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keyboard_configs
    ADD CONSTRAINT keyboard_configs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: keyboard_configs unique_bot_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.keyboard_configs
    ADD CONSTRAINT unique_bot_token UNIQUE (bot_token);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_bot_users_bot_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_users_bot_token ON public.bot_users USING btree (bot_token);


--
-- Name: idx_bot_users_telegram_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bot_users_telegram_user_id ON public.bot_users USING btree (telegram_user_id);


--
-- Name: idx_keyboard_configs_menu_admin_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_keyboard_configs_menu_admin_chat_id ON public.keyboard_configs USING btree (menu_admin_chat_id);


--
-- Name: bot_activations update_bot_activations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bot_activations_updated_at BEFORE UPDATE ON public.bot_activations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bot_users update_bot_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bot_users_updated_at BEFORE UPDATE ON public.bot_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: keyboard_configs update_keyboard_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_keyboard_configs_updated_at BEFORE UPDATE ON public.keyboard_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bot_activations validate_bot_expiry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_bot_expiry_trigger BEFORE INSERT OR UPDATE ON public.bot_activations FOR EACH ROW EXECUTE FUNCTION public.validate_bot_expiry();


--
-- Name: activation_codes activation_codes_used_by_bot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_used_by_bot_id_fkey FOREIGN KEY (used_by_bot_id) REFERENCES public.bot_activations(id) ON DELETE SET NULL;


--
-- Name: bot_activations bot_activations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bot_activations
    ADD CONSTRAINT bot_activations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_bot_activation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_bot_activation_id_fkey FOREIGN KEY (bot_activation_id) REFERENCES public.bot_activations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bot_activations Admins can manage all bots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all bots" ON public.bot_activations USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: activation_codes Admins can manage all codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all codes" ON public.activation_codes USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: messages Admins can manage all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all messages" ON public.messages USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: disabled_users Admins can manage disabled users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage disabled users" ON public.disabled_users USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bot_trial_records Admins can manage trial records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage trial records" ON public.bot_trial_records USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bot_users Anyone can delete bot users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete bot users" ON public.bot_users FOR DELETE USING (true);


--
-- Name: keyboard_configs Anyone can delete keyboard configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete keyboard configs" ON public.keyboard_configs FOR DELETE USING (true);


--
-- Name: bot_users Anyone can insert bot users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert bot users" ON public.bot_users FOR INSERT WITH CHECK (true);


--
-- Name: keyboard_configs Anyone can insert keyboard configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert keyboard configs" ON public.keyboard_configs FOR INSERT WITH CHECK (true);


--
-- Name: messages Anyone can insert messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);


--
-- Name: bot_trial_records Anyone can insert trial records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert trial records" ON public.bot_trial_records FOR INSERT WITH CHECK (true);


--
-- Name: bot_activations Anyone can read active bots by activation code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active bots by activation code" ON public.bot_activations FOR SELECT USING (true);


--
-- Name: bot_users Anyone can read bot users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read bot users" ON public.bot_users FOR SELECT USING (true);


--
-- Name: activation_codes Anyone can read codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read codes" ON public.activation_codes FOR SELECT USING (true);


--
-- Name: keyboard_configs Anyone can read keyboard configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read keyboard configs" ON public.keyboard_configs FOR SELECT USING (true);


--
-- Name: messages Anyone can read messages for valid bots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read messages for valid bots" ON public.messages FOR SELECT USING (true);


--
-- Name: bot_trial_records Anyone can read trial records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read trial records" ON public.bot_trial_records FOR SELECT USING (true);


--
-- Name: bot_users Anyone can update bot users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update bot users" ON public.bot_users FOR UPDATE USING (true);


--
-- Name: keyboard_configs Anyone can update keyboard configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update keyboard configs" ON public.keyboard_configs FOR UPDATE USING (true);


--
-- Name: bot_trial_records Anyone can update trial records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update trial records" ON public.bot_trial_records FOR UPDATE USING (true);


--
-- Name: disabled_users Users can check their own disabled status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can check their own disabled status" ON public.disabled_users FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: bot_activations Users can claim guest bots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can claim guest bots" ON public.bot_activations FOR UPDATE TO authenticated USING ((user_id IS NULL)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: bot_activations Users can update own bots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own bots" ON public.bot_activations FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activation_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: bot_activations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bot_activations ENABLE ROW LEVEL SECURITY;

--
-- Name: bot_trial_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bot_trial_records ENABLE ROW LEVEL SECURITY;

--
-- Name: bot_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;

--
-- Name: disabled_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.disabled_users ENABLE ROW LEVEL SECURITY;

--
-- Name: keyboard_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.keyboard_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;