# supportyourlocal.band

What would a local band need?

## Key Features

### MVP

OK, the "Minimal Work from Me" version is still too much work to get started. I think a static site is the best first step. (And maybe the best overall as well.) Just base it off of our current site.

* Mobile-first design
* Home page with sections
* EPK
* Gigs / Previous gigs
* Contact information

### Minimal Work from Me

Face it, if this takes a lot of my time I won't do it. I'm happy to add features and do basic tech support, but **all** of the administration needs to be done by the bands.

### Email

Managing an email list and sending out newsletters and updates is something that I have not found a source I like for yet. This is the key feature.

### Song List

This will not only be a source of information for their home page, but will fuel set list creation. Data should include song title, artist, link (or links) to audio, duration, and flags for featured and mothballed.

### External Links

This site is meant to be a central location. You can upgrade (or downgrade) your site to paid/self-hosted at any time without penalty or hassle. (If you wanted a custom domain, for instance.) Everything else can be linked to.

### Style Guide

It will make style guides easy and fun! Home pages and emails will use templates that will apply the styles automatically. This is the real killer feature.

### The Rest

I think we need a way to post gigs. This should be easy and be an alternative to Facebook events. Maybe for ease we can integrate with Facebook events to automatically pull stuff in. Or not. This should include venue information.

Fan accounts. Like/follow bands. Write "reviews"

## Monitization

Custom domain, more storage space (for photos.)

Advertise for local venues and bands.

# Architecture

Separate api and front-end into different repos.

Make all sites https

Admin key in .env (for backups and troubleshooting)

### env

* Site URL
* admin token

## Features for next version

Deploy separate font and back ends to prod.

Put sites in /srv/bandname/supportyourlocal /srv/bandname/kandy

When a user is added, create a token and reset link.

### Releases (include albums) (Needed for B&B to fully adopt back end)

* Name (if album)
* Select an original recording song or songs.
* Release date
* Description
* Front and back covers
* Song list
* Album links (Spotify, etc.)
* Add alert

#### Front End

* Front-end nav build from JSON
* video embed (FB and YouTube)
* Songs page. If no releases, then list.
* If releases, then show with top button to "All Songs"
* Include upcoming releases somehow?
