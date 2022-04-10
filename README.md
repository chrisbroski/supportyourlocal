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

## API Style

Is there a way to use a checkbox and sibling selector to manage pop-out mobile menu without JS?

Auto login after password change or set

Abstract out error/msg section in all templates

Triple-bracket API_DIR in templates (and other HTML source formatting improvements)

Song media should be an array that includes media type (Spotify, mp3, etc.) a URL, description, and credits.

## Features for next version

### Tests

Songs partially done. The rest, not at all

### Known Bugs

* Select boxes not persisting after 400
* Deletion can cause invalid state
* Updates don't persist new form data after 400

## Features for next next version

Style guide page

Add list to side of update (single) edit pages too, if width sufficient (otherwise hide)

All https

Get local features working with member cities. "Check in" on mobile when at open mics, etc.

Add venmo/etc. pay information.

Central Site

Single releases should be allowed 2 songs

Add 0 to infinite media - audio, video to songs and releases. Add 0 to infinte album art to a release.

Rename repo to yourlocalband

Manage which pages are displayed: their page names and open graph data

Floating update button?

Image upload

#### Setup Agreement:

On setup, read and agree to rules:

1. Do not libel or harrass other bands or their fandom.
2. Make your city locations accurate and non-spammy.

Also, setup need more work:
* When you hit the front-end site it is weird
