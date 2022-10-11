# Backlog

What would a local band need?

## Key Features

### MVP

* Mobile-first design
* Home page with sections
* EPK
* Gigs / Previous gigs
* Contact information

### Email

Managing an email list and sending out newsletters and updates is something that I have not found a source I like for yet. This is a key feature.

### Browser Push Notifications

Killer feature! This is what everyone will want. (So dont' implement until the core structures are done and there are at least 10 beta users.)

### Song List

This will not only be a source of information for their home page, but will fuel set list creation. Data should include song title, artist, link (or links) to audio, duration, and flags for featured and mothballed.

### External Links

This site is meant to be a central location. You can upgrade (or downgrade) your site to paid/self-hosted at any time without penalty or hassle. (If you wanted a custom domain, for instance.) Everything else can be linked to.

### Style Guide

It will make style guides easy and fun! Home pages and emails will use templates that will apply the styles automatically. This is the real killer feature.

### The Rest

Fan accounts. Like/follow bands. Write "reviews"

## Monitization

Custom domain, more storage space (for photos.)

Advertise for local venues and bands.

Add "powered by yourlocal.band" on site.

## API Style

Endure backup and parse test. (In case of catastrophic failure.)

## Features for next version

HTTPS

Data tools (QA and deploy scripts.)

Password recovery (email)

EPK

More data validation and deletion checks (e.g. can't delete song if part of release, venue if part of gig, etc.)

Onboarding

### Tests

Songs partially done. The rest, not at all

### Known Bugs

* Updates don't persist new form data after 400
* Deletion can cause invalid state
* Small photos might create thumbnails larger than themselves. (Is this really a problem?)
* A "track" type Spotify link for release media breaks stuff on the front end.
* If blank make gig duration 0
* iOS Safari has dates and times wrong. Use TZ from venue.
* Can't see everything on Mike's ridiculous screen
* Need venue address handling - festival name, stage
* Need to revoke map API key (it got exposed in Git, whoops)

## Features for next next version

Handle live stream gigs.

Get local features working with member cities. "Check in" on mobile when at open mics, etc.

Playing live now!

Browser push notifications

Set up back end as front end ("secure" and "private" - no JS or cookies. Also accessible. Talk to Rob C!)

3rd-party cookie option (will replace maps and audio embed with external links)

### Email List

Export instructions to email them your damn self. Add phone number too for mass spam texting.

## Onboarding:

On setup, read and agree to rules:

1. Do not libel or harrass other bands or their fandom.
2. Make your city locations accurate and non-spammy.

## Setup

1. Agree to rules (above)
2. username and password
2. Style
3. Add band data

Also, setup needs more work:

* When you hit the front-end site it is weird
* Write new site script and test

## Central Site

### Blog articles

Funnel from QR code to persistent connection.

## Before Next 10

Onboarding process, https, password recovery via email, data tools (backup and restore data.json, local QA and deployment.)
