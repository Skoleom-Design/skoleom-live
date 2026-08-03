--
-- PostgreSQL database dump
--

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: admin_action_logs_action_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admin_action_logs_action_enum AS ENUM (
    'plan_change',
    'status_change',
    'credit',
    'boost_grant',
    'boost_cancel',
    'boost_approve'
);


--
-- Name: boosts_objective_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.boosts_objective_enum AS ENUM (
    'views',
    'sales',
    'followers'
);


--
-- Name: boosts_scope_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.boosts_scope_enum AS ENUM (
    'post',
    'account'
);


--
-- Name: boosts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.boosts_status_enum AS ENUM (
    'pending',
    'active',
    'completed',
    'cancelled'
);


--
-- Name: capsules_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capsules_category_enum AS ENUM (
    'vetement',
    'chaussures',
    'accessoire',
    'objet'
);


--
-- Name: capsules_condition_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capsules_condition_enum AS ENUM (
    'neuf_avec_etiquette',
    'neuf_sans_etiquette',
    'tres_bon_etat',
    'bon_etat',
    'satisfaisant'
);


--
-- Name: capsules_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.capsules_status_enum AS ENUM (
    'available',
    'sold_out',
    'archived'
);


--
-- Name: live_sessions_mode_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.live_sessions_mode_enum AS ENUM (
    'live',
    'auction'
);


--
-- Name: live_sessions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.live_sessions_status_enum AS ENUM (
    'live',
    'ended'
);


--
-- Name: notifications_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notifications_type_enum AS ENUM (
    'like',
    'comment'
);


--
-- Name: orders_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orders_status_enum AS ENUM (
    'pending',
    'paid',
    'delivered',
    'refunded'
);


--
-- Name: posts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.posts_status_enum AS ENUM (
    'active',
    'archived',
    'moderated'
);


--
-- Name: posts_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.posts_type_enum AS ENUM (
    'video',
    'photo'
);


--
-- Name: users_plan_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.users_plan_enum AS ENUM (
    'free',
    'premium',
    'ultra'
);


--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.users_role_enum AS ENUM (
    'creator',
    'buyer',
    'admin'
);


--
-- Name: wallet_transactions_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wallet_transactions_type_enum AS ENUM (
    'topup',
    'withdrawal',
    'capsule_purchase',
    'capsule_sale_pending',
    'capsule_sale_released',
    'gift_sent',
    'gift_received',
    'admin_credit',
    'boost_purchase'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_action_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_action_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    action public.admin_action_logs_action_enum NOT NULL,
    "adminId" uuid NOT NULL,
    "targetUserId" character varying NOT NULL,
    details json,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: auction_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_bids (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "liveSessionId" uuid NOT NULL,
    "bidderId" uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: boosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boosts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    status public.boosts_status_enum DEFAULT 'pending'::public.boosts_status_enum NOT NULL,
    objective public.boosts_objective_enum DEFAULT 'views'::public.boosts_objective_enum NOT NULL,
    scope public.boosts_scope_enum DEFAULT 'post'::public.boosts_scope_enum NOT NULL,
    budget numeric(10,2) NOT NULL,
    spent numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    currency character varying DEFAULT 'EUR'::character varying NOT NULL,
    "stripePaymentIntentId" character varying,
    "durationDays" integer NOT NULL,
    "startedAt" timestamp without time zone,
    "endedAt" timestamp without time zone,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    "userId" uuid NOT NULL,
    "postId" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: capsule_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capsule_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    "creatorId" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: capsules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capsules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    brand character varying,
    description text,
    price numeric(10,2) NOT NULL,
    currency character varying DEFAULT 'EUR'::character varying NOT NULL,
    status public.capsules_status_enum DEFAULT 'available'::public.capsules_status_enum NOT NULL,
    "imageUrl" character varying,
    images json,
    condition public.capsules_condition_enum,
    category public.capsules_category_enum,
    size character varying,
    subcategory character varying,
    colors json,
    variants json,
    stock integer DEFAULT 0 NOT NULL,
    "soldCount" integer DEFAULT 0 NOT NULL,
    "commissionRate" numeric(5,2) DEFAULT '15'::numeric NOT NULL,
    "groupId" uuid,
    "creatorId" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    text text NOT NULL,
    "userId" uuid NOT NULL,
    "postId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gifts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "giftType" character varying NOT NULL,
    "senderId" uuid NOT NULL,
    "receiverId" uuid,
    "liveSessionId" uuid,
    amount numeric(10,2) NOT NULL,
    "creatorAmount" numeric(10,2) NOT NULL,
    "platformAmount" numeric(10,2) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_capsules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_capsules (
    "liveSessionsId" uuid NOT NULL,
    "capsulesId" uuid NOT NULL
);


--
-- Name: live_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    text text NOT NULL,
    "userId" uuid NOT NULL,
    "liveSessionId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying,
    status public.live_sessions_status_enum DEFAULT 'live'::public.live_sessions_status_enum NOT NULL,
    mode public.live_sessions_mode_enum DEFAULT 'live'::public.live_sessions_mode_enum NOT NULL,
    "creatorId" uuid NOT NULL,
    "startedAt" timestamp without time zone,
    "endedAt" timestamp without time zone,
    "featuredCapsuleId" uuid,
    "auctionCapsuleId" uuid,
    "startingBid" numeric(10,2),
    "currentBid" numeric(10,2),
    "currentBidderId" uuid,
    "auctionEndsAt" timestamp without time zone,
    "auctionSettled" boolean DEFAULT false NOT NULL,
    "auctionActive" boolean DEFAULT false NOT NULL,
    "auctionRoundsCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.notifications_type_enum NOT NULL,
    "recipientId" character varying NOT NULL,
    "actorId" uuid NOT NULL,
    "postId" uuid,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    status public.orders_status_enum DEFAULT 'pending'::public.orders_status_enum NOT NULL,
    amount numeric(10,2) NOT NULL,
    "commissionAmount" numeric(10,2) NOT NULL,
    "creatorAmount" numeric(10,2) NOT NULL,
    currency character varying DEFAULT 'EUR'::character varying NOT NULL,
    "stripePaymentIntentId" character varying,
    "selectedVariant" character varying,
    "shippingAddress" json,
    "buyerId" uuid NOT NULL,
    "capsuleId" uuid NOT NULL,
    "creatorId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: post_capsules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_capsules (
    "postsId" uuid NOT NULL,
    "capsulesId" uuid NOT NULL
);


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_likes (
    "postsId" uuid NOT NULL,
    "usersId" uuid NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    caption text,
    type public.posts_type_enum DEFAULT 'video'::public.posts_type_enum NOT NULL,
    status public.posts_status_enum DEFAULT 'active'::public.posts_status_enum NOT NULL,
    "mediaUrl" character varying NOT NULL,
    "thumbnailUrl" character varying,
    tags json,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "likeCount" integer DEFAULT 0 NOT NULL,
    "shareCount" integer DEFAULT 0 NOT NULL,
    "commentCount" integer DEFAULT 0 NOT NULL,
    "boostScore" integer DEFAULT 0 NOT NULL,
    "isBoosted" boolean DEFAULT false NOT NULL,
    "musicName" character varying,
    "musicUrl" character varying,
    "creatorId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    username character varying NOT NULL,
    "displayName" character varying,
    "avatarUrl" character varying,
    bio text,
    role public.users_role_enum DEFAULT 'creator'::public.users_role_enum NOT NULL,
    plan public.users_plan_enum DEFAULT 'free'::public.users_plan_enum NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "totalEarnings" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "walletBalance" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "pendingBalance" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "stripeAccountId" character varying,
    "instagramUserId" character varying,
    "instagramUsername" character varying,
    "instagramAccessToken" character varying,
    "instagramTokenExpiresAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying NOT NULL,
    type public.wallet_transactions_type_enum NOT NULL,
    amount numeric(10,2) NOT NULL,
    description character varying,
    reference character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_capsules PK_042a54d71d36a39cbe4840819ce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_capsules
    ADD CONSTRAINT "PK_042a54d71d36a39cbe4840819ce" PRIMARY KEY ("liveSessionsId", "capsulesId");


--
-- Name: admin_action_logs PK_1cbd6d5a6c8cc626adaa7655bc4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_action_logs
    ADD CONSTRAINT "PK_1cbd6d5a6c8cc626adaa7655bc4" PRIMARY KEY (id);


--
-- Name: capsules PK_1d1ddb399b2630cf64f197d98da; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsules
    ADD CONSTRAINT "PK_1d1ddb399b2630cf64f197d98da" PRIMARY KEY (id);


--
-- Name: boosts PK_225335d93bbce36b48152a26b48; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT "PK_225335d93bbce36b48152a26b48" PRIMARY KEY (id);


--
-- Name: posts PK_2829ac61eff60fcec60d7274b9e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY (id);


--
-- Name: capsule_groups PK_2bea5013f356ebae24bd9dc7914; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsule_groups
    ADD CONSTRAINT "PK_2bea5013f356ebae24bd9dc7914" PRIMARY KEY (id);


--
-- Name: wallet_transactions PK_5120f131bde2cda940ec1a621db; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT "PK_5120f131bde2cda940ec1a621db" PRIMARY KEY (id);


--
-- Name: gifts PK_54242922934e1f322861d116af7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts
    ADD CONSTRAINT "PK_54242922934e1f322861d116af7" PRIMARY KEY (id);


--
-- Name: live_comments PK_68cbdfbcd790169a6cb79dd75fb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_comments
    ADD CONSTRAINT "PK_68cbdfbcd790169a6cb79dd75fb" PRIMARY KEY (id);


--
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: orders PK_710e2d4957aa5878dfe94e4ac2f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id);


--
-- Name: auction_bids PK_75fb5ac3cf131789bf7c5181efb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_bids
    ADD CONSTRAINT "PK_75fb5ac3cf131789bf7c5181efb" PRIMARY KEY (id);


--
-- Name: post_capsules PK_799cb4141be962b81eaa3b161db; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_capsules
    ADD CONSTRAINT "PK_799cb4141be962b81eaa3b161db" PRIMARY KEY ("postsId", "capsulesId");


--
-- Name: post_likes PK_84c2aede8e0b03b3a26ca7b5846; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT "PK_84c2aede8e0b03b3a26ca7b5846" PRIMARY KEY ("postsId", "usersId");


--
-- Name: comments PK_8bf68bc960f2b69e818bdb90dcb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: live_sessions PK_cc3225418b55b1e022dbfb6dca5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT "PK_cc3225418b55b1e022dbfb6dca5" PRIMARY KEY (id);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: IDX_035834c9937345a1c27d5f7c30; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_035834c9937345a1c27d5f7c30" ON public.post_capsules USING btree ("postsId");


--
-- Name: IDX_31727b5936eeab3313c2eb45ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_31727b5936eeab3313c2eb45ae" ON public.live_capsules USING btree ("liveSessionsId");


--
-- Name: IDX_a2eba635b69777b11efb0ecca2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a2eba635b69777b11efb0ecca2" ON public.post_likes USING btree ("usersId");


--
-- Name: IDX_b47416b182c04b0a8feddb5228; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b47416b182c04b0a8feddb5228" ON public.live_capsules USING btree ("capsulesId");


--
-- Name: IDX_db873ba9a123711a4bff527ccd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_db873ba9a123711a4bff527ccd" ON public.notifications USING btree ("recipientId");


--
-- Name: IDX_dc163186e0f761d7a86dd13527; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dc163186e0f761d7a86dd13527" ON public.post_capsules USING btree ("capsulesId");


--
-- Name: IDX_e4b9fa42093474796954477662; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e4b9fa42093474796954477662" ON public.post_likes USING btree ("postsId");


--
-- Name: post_capsules FK_035834c9937345a1c27d5f7c303; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_capsules
    ADD CONSTRAINT "FK_035834c9937345a1c27d5f7c303" FOREIGN KEY ("postsId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: auction_bids FK_04440c90ed1896078c5c4162d8f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_bids
    ADD CONSTRAINT "FK_04440c90ed1896078c5c4162d8f" FOREIGN KEY ("liveSessionId") REFERENCES public.live_sessions(id);


--
-- Name: admin_action_logs FK_0657912c965ab7658e3c1f388c4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_action_logs
    ADD CONSTRAINT "FK_0657912c965ab7658e3c1f388c4" FOREIGN KEY ("adminId") REFERENCES public.users(id);


--
-- Name: boosts FK_082b4a23f436ffb7c57d95e2beb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT "FK_082b4a23f436ffb7c57d95e2beb" FOREIGN KEY ("postId") REFERENCES public.posts(id);


--
-- Name: gifts FK_1311062aab105945666daaa648e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts
    ADD CONSTRAINT "FK_1311062aab105945666daaa648e" FOREIGN KEY ("liveSessionId") REFERENCES public.live_sessions(id);


--
-- Name: live_comments FK_17a29f2f67048bbac4489408fa9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_comments
    ADD CONSTRAINT "FK_17a29f2f67048bbac4489408fa9" FOREIGN KEY ("liveSessionId") REFERENCES public.live_sessions(id);


--
-- Name: live_sessions FK_1b9b98fea21cc0fec9a79057bc0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT "FK_1b9b98fea21cc0fec9a79057bc0" FOREIGN KEY ("auctionCapsuleId") REFERENCES public.capsules(id);


--
-- Name: live_capsules FK_31727b5936eeab3313c2eb45aef; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_capsules
    ADD CONSTRAINT "FK_31727b5936eeab3313c2eb45aef" FOREIGN KEY ("liveSessionsId") REFERENCES public.live_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications FK_44412a2d6f162ff4dc1697d0db7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_44412a2d6f162ff4dc1697d0db7" FOREIGN KEY ("actorId") REFERENCES public.users(id);


--
-- Name: orders FK_7a388b0b04800f3fd856ffb48c2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_7a388b0b04800f3fd856ffb48c2" FOREIGN KEY ("capsuleId") REFERENCES public.capsules(id);


--
-- Name: gifts FK_7cfae3fdd59f5852b5474456b5c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts
    ADD CONSTRAINT "FK_7cfae3fdd59f5852b5474456b5c" FOREIGN KEY ("receiverId") REFERENCES public.users(id);


--
-- Name: comments FK_7e8d7c49f218ebb14314fdb3749; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: auction_bids FK_8ed7f1b2b910713754a47c65721; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_bids
    ADD CONSTRAINT "FK_8ed7f1b2b910713754a47c65721" FOREIGN KEY ("bidderId") REFERENCES public.users(id);


--
-- Name: live_sessions FK_91489ca597c80e3f5580ad22b9a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT "FK_91489ca597c80e3f5580ad22b9a" FOREIGN KEY ("featuredCapsuleId") REFERENCES public.capsules(id);


--
-- Name: notifications FK_93c464aaf70fb0720dc500e93c8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_93c464aaf70fb0720dc500e93c8" FOREIGN KEY ("postId") REFERENCES public.posts(id);


--
-- Name: orders FK_9877ffd9a491c3e82f5b32d4f4d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_9877ffd9a491c3e82f5b32d4f4d" FOREIGN KEY ("buyerId") REFERENCES public.users(id);


--
-- Name: post_likes FK_a2eba635b69777b11efb0ecca24; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT "FK_a2eba635b69777b11efb0ecca24" FOREIGN KEY ("usersId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: capsules FK_adebf812ea363202f994499ce76; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capsules
    ADD CONSTRAINT "FK_adebf812ea363202f994499ce76" FOREIGN KEY ("groupId") REFERENCES public.capsule_groups(id) ON DELETE SET NULL;


--
-- Name: orders FK_b40146eff5004cd1e86c15aa987; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_b40146eff5004cd1e86c15aa987" FOREIGN KEY ("creatorId") REFERENCES public.users(id);


--
-- Name: live_capsules FK_b47416b182c04b0a8feddb52289; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_capsules
    ADD CONSTRAINT "FK_b47416b182c04b0a8feddb52289" FOREIGN KEY ("capsulesId") REFERENCES public.capsules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: posts FK_c07f375e63832303f0a5049b776; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT "FK_c07f375e63832303f0a5049b776" FOREIGN KEY ("creatorId") REFERENCES public.users(id);


--
-- Name: live_sessions FK_c1c43b8eb03c6dc655b1d4f9472; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT "FK_c1c43b8eb03c6dc655b1d4f9472" FOREIGN KEY ("creatorId") REFERENCES public.users(id);


--
-- Name: post_capsules FK_dc163186e0f761d7a86dd135273; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_capsules
    ADD CONSTRAINT "FK_dc163186e0f761d7a86dd135273" FOREIGN KEY ("capsulesId") REFERENCES public.capsules(id);


--
-- Name: comments FK_e44ddaaa6d058cb4092f83ad61f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" FOREIGN KEY ("postId") REFERENCES public.posts(id);


--
-- Name: post_likes FK_e4b9fa420934747969544776626; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT "FK_e4b9fa420934747969544776626" FOREIGN KEY ("postsId") REFERENCES public.posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: gifts FK_ee13c1c71ac6b4d5e669519d81b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts
    ADD CONSTRAINT "FK_ee13c1c71ac6b4d5e669519d81b" FOREIGN KEY ("senderId") REFERENCES public.users(id);


--
-- Name: live_sessions FK_f6f9019f39694b1efa381be7465; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT "FK_f6f9019f39694b1efa381be7465" FOREIGN KEY ("currentBidderId") REFERENCES public.users(id);


--
-- Name: boosts FK_f7460e6f5e6df9ad8b4f1266e0c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT "FK_f7460e6f5e6df9ad8b4f1266e0c" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: live_comments FK_fd09538882c990ac4fa5a522f1d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_comments
    ADD CONSTRAINT "FK_fd09538882c990ac4fa5a522f1d" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

