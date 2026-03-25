#!/usr/bin/env python3
"""Generate Skyfield/DE440 reference data for celestial-navigator test suite.

Outputs:
  - star_sha_ref.csv          — N random star SHA/Dec readings at random dates
  - sight_reduction_ref.csv   — N random sightings (topocentric alt/az)

All positions are apparent-place (includes aberration, precession, nutation).

Usage:
  python bench.py [N]       # generate N test cases per file (default 200)
"""

import csv
import os
import random
import sys
from datetime import datetime, timedelta
from skyfield.api import load, Star, wgs84, Topos

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
random.seed()  # fresh data each run

# ── Load ephemeris ──────────────────────────────────────────────
ts = load.timescale()
eph = load('de440s.bsp')
earth = eph['earth']

# ── All 58 navigational stars (Hipparcos J2000.0) ──────────────
NAV_STARS = {
    'Acamar':      dict(ra_hours=2.9710,  dec_degrees=-40.305, pm_ra_cosdec=-3.5,   pm_dec=-78.0),
    'Achernar':    dict(ra_hours=1.6286,  dec_degrees=-57.237, pm_ra_cosdec=88.0,   pm_dec=-40.0),
    'Acrux':       dict(ra_hours=12.4433, dec_degrees=-63.099, pm_ra_cosdec=-35.0,  pm_dec=-12.0),
    'Adhara':      dict(ra_hours=6.9771,  dec_degrees=-28.972, pm_ra_cosdec=3.0,    pm_dec=2.0),
    'Aldebaran':   dict(ra_hours=4.5987,  dec_degrees=16.509,  pm_ra_cosdec=63.0,   pm_dec=-190.0),
    'Alioth':      dict(ra_hours=12.9005, dec_degrees=55.960,  pm_ra_cosdec=111.0,  pm_dec=-9.0),
    'Alkaid':      dict(ra_hours=13.7923, dec_degrees=49.313,  pm_ra_cosdec=-121.0, pm_dec=-15.0),
    'Alnair':      dict(ra_hours=22.1372, dec_degrees=-46.961, pm_ra_cosdec=127.0,  pm_dec=-148.0),
    'Alnilam':     dict(ra_hours=5.6035,  dec_degrees=-1.202,  pm_ra_cosdec=1.0,    pm_dec=-1.0),
    'Alphard':     dict(ra_hours=9.4598,  dec_degrees=-8.659,  pm_ra_cosdec=-14.0,  pm_dec=33.0),
    'Alphecca':    dict(ra_hours=15.5781, dec_degrees=26.715,  pm_ra_cosdec=121.0,  pm_dec=-89.0),
    'Alpheratz':   dict(ra_hours=0.1398,  dec_degrees=29.090,  pm_ra_cosdec=136.0,  pm_dec=-163.0),
    'Altair':      dict(ra_hours=19.8464, dec_degrees=8.868,   pm_ra_cosdec=536.0,  pm_dec=386.0),
    'Ankaa':       dict(ra_hours=0.4381,  dec_degrees=-42.306, pm_ra_cosdec=233.0,  pm_dec=-356.0),
    'Antares':     dict(ra_hours=16.4901, dec_degrees=-26.432, pm_ra_cosdec=-10.0,  pm_dec=-23.0),
    'Arcturus':    dict(ra_hours=14.2610, dec_degrees=19.182,  pm_ra_cosdec=-1094.0,pm_dec=-1999.0),
    'Atria':       dict(ra_hours=16.8111, dec_degrees=-69.028, pm_ra_cosdec=18.0,   pm_dec=-32.0),
    'Avior':       dict(ra_hours=8.3752,  dec_degrees=-59.509, pm_ra_cosdec=-25.0,  pm_dec=14.0),
    'Bellatrix':   dict(ra_hours=5.4189,  dec_degrees=6.350,   pm_ra_cosdec=-9.0,   pm_dec=-13.0),
    'Betelgeuse':  dict(ra_hours=5.9195,  dec_degrees=7.407,   pm_ra_cosdec=27.0,   pm_dec=11.0),
    'Canopus':     dict(ra_hours=6.3992,  dec_degrees=-52.696, pm_ra_cosdec=19.0,   pm_dec=24.0),
    'Capella':     dict(ra_hours=5.2781,  dec_degrees=45.998,  pm_ra_cosdec=75.0,   pm_dec=-427.0),
    'Deneb':       dict(ra_hours=20.6905, dec_degrees=45.280,  pm_ra_cosdec=2.0,    pm_dec=2.0),
    'Denebola':    dict(ra_hours=11.8177, dec_degrees=14.572,  pm_ra_cosdec=-499.0, pm_dec=-114.0),
    'Diphda':      dict(ra_hours=0.7265,  dec_degrees=-17.987, pm_ra_cosdec=233.0,  pm_dec=32.0),
    'Dubhe':       dict(ra_hours=11.0621, dec_degrees=61.751,  pm_ra_cosdec=-137.0, pm_dec=-35.0),
    'Elnath':      dict(ra_hours=5.4382,  dec_degrees=28.607,  pm_ra_cosdec=23.0,   pm_dec=-175.0),
    'Eltanin':     dict(ra_hours=17.9435, dec_degrees=51.489,  pm_ra_cosdec=-8.0,   pm_dec=-23.0),
    'Enif':        dict(ra_hours=21.7364, dec_degrees=9.875,   pm_ra_cosdec=26.0,   pm_dec=-1.0),
    'Fomalhaut':   dict(ra_hours=22.9609, dec_degrees=-29.622, pm_ra_cosdec=329.0,  pm_dec=-165.0),
    'Gacrux':      dict(ra_hours=12.5194, dec_degrees=-57.113, pm_ra_cosdec=27.0,   pm_dec=-264.0),
    'Gienah':      dict(ra_hours=12.2635, dec_degrees=-17.542, pm_ra_cosdec=-159.0, pm_dec=23.0),
    'Hadar':       dict(ra_hours=14.0637, dec_degrees=-60.373, pm_ra_cosdec=-33.0,  pm_dec=-24.0),
    'Hamal':       dict(ra_hours=2.1195,  dec_degrees=23.463,  pm_ra_cosdec=188.0,  pm_dec=-148.0),
    'Kaus Aus.':   dict(ra_hours=18.4029, dec_degrees=-34.385, pm_ra_cosdec=-39.0,  pm_dec=-124.0),
    'Kochab':      dict(ra_hours=14.8451, dec_degrees=74.156,  pm_ra_cosdec=-32.0,  pm_dec=12.0),
    'Markab':      dict(ra_hours=23.0793, dec_degrees=15.205,  pm_ra_cosdec=61.0,   pm_dec=-43.0),
    'Menkar':      dict(ra_hours=3.0380,  dec_degrees=4.090,   pm_ra_cosdec=-6.0,   pm_dec=-78.0),
    'Menkent':     dict(ra_hours=14.1114, dec_degrees=-36.370, pm_ra_cosdec=-519.0, pm_dec=-518.0),
    'Miaplacidus': dict(ra_hours=9.2200,  dec_degrees=-69.717, pm_ra_cosdec=-156.0, pm_dec=108.0),
    'Mirfak':      dict(ra_hours=3.4054,  dec_degrees=49.861,  pm_ra_cosdec=24.0,   pm_dec=-26.0),
    'Nunki':       dict(ra_hours=18.9211, dec_degrees=-26.297, pm_ra_cosdec=13.0,   pm_dec=-54.0),
    'Peacock':     dict(ra_hours=20.4275, dec_degrees=-56.735, pm_ra_cosdec=7.0,    pm_dec=-86.0),
    'Polaris':     dict(ra_hours=2.5303,  dec_degrees=89.264,  pm_ra_cosdec=44.0,   pm_dec=-12.0),
    'Pollux':      dict(ra_hours=7.7553,  dec_degrees=28.026,  pm_ra_cosdec=-625.0, pm_dec=-46.0),
    'Procyon':     dict(ra_hours=7.6551,  dec_degrees=5.225,   pm_ra_cosdec=-715.0, pm_dec=-1037.0),
    'Rasalhague':  dict(ra_hours=17.5823, dec_degrees=12.560,  pm_ra_cosdec=109.0,  pm_dec=-226.0),
    'Regulus':     dict(ra_hours=10.1395, dec_degrees=11.967,  pm_ra_cosdec=-249.0, pm_dec=6.0),
    'Rigel':       dict(ra_hours=5.2423,  dec_degrees=-8.202,  pm_ra_cosdec=1.0,    pm_dec=-1.0),
    'Rigil Kent':  dict(ra_hours=14.6601, dec_degrees=-60.834, pm_ra_cosdec=-3679.0,pm_dec=474.0, parallax=742.0),
    'Sabik':       dict(ra_hours=17.1730, dec_degrees=-15.725, pm_ra_cosdec=41.0,   pm_dec=97.0),
    'Schedar':     dict(ra_hours=0.6751,  dec_degrees=56.537,  pm_ra_cosdec=50.0,   pm_dec=-33.0),
    'Shaula':      dict(ra_hours=17.5601, dec_degrees=-37.104, pm_ra_cosdec=-8.0,   pm_dec=-30.0),
    'Sirius':      dict(ra_hours=6.7524,  dec_degrees=-16.716, pm_ra_cosdec=-546.0, pm_dec=-1223.0, parallax=379.0),
    'Spica':       dict(ra_hours=13.4199, dec_degrees=-11.161, pm_ra_cosdec=-42.0,  pm_dec=-31.0),
    'Suhail':      dict(ra_hours=9.1333,  dec_degrees=-43.433, pm_ra_cosdec=-24.0,  pm_dec=14.0),
    'Vega':        dict(ra_hours=18.6156, dec_degrees=38.784,  pm_ra_cosdec=201.0,  pm_dec=286.0, parallax=130.0),
    'Zubenelg.':   dict(ra_hours=14.8480, dec_degrees=-16.042, pm_ra_cosdec=-106.0, pm_dec=-69.0),
}

def make_star(d):
    return Star(
        ra_hours=d['ra_hours'],
        dec_degrees=d['dec_degrees'],
        ra_mas_per_year=d['pm_ra_cosdec'],
        dec_mas_per_year=d['pm_dec'],
        parallax_mas=d.get('parallax', 0.0),
    )

def random_date(start_year=2000, end_year=2050):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = (end - start).days * 86400
    return start + timedelta(seconds=random.randrange(delta))

star_names = list(NAV_STARS.keys())

# ── N star SHA/Dec readings at random dates ────────────────────
print(f"Generating {N} star SHA/Dec reference readings...")
sha_rows = []
for i in range(N):
    dt = random_date()
    t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
    name = random.choice(star_names)
    star = make_star(NAV_STARS[name])
    apparent = earth.at(t).observe(star).apparent()
    ra, dec, _ = apparent.radec(epoch='date')
    ra_deg = ra._degrees
    sha = (360 - ra_deg) % 360
    sha_rows.append({
        'utc': t.utc_iso(),
        'star': name,
        'sha_deg': round(sha, 5),
        'dec_deg': round(dec.degrees, 5),
    })

with open('star_sha_ref.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['utc', 'star', 'sha_deg', 'dec_deg'])
    w.writeheader()
    w.writerows(sha_rows)
print(f"  → star_sha_ref.csv: {len(sha_rows)} readings")

# ── 200 sightings (topocentric alt/az) ─────────────────────────
locations = [
    ('Equator/Prime', 0.0, 0.0),
    ('North Pole', 89.9, 0.0),
    ('South Pole', -89.9, 0.0),
    ('Intl Date Line', 20.0, 179.9),
    ('Southern Ocean', -55.0, -120.0),
    ('Mid-Atlantic', 35.0, -40.0),
    ('Tokyo', 35.6, 139.7),
    ('Cape Horn', -55.9, -67.2),
    ('Florence', 43.77, 11.25),
    ('Reykjavik', 64.15, -21.95),
    ('Singapore', 1.35, 103.82),
    ('Sydney', -33.87, 151.21),
]

body_map = {
    'Sun': eph['sun'],
    'Moon': eph['moon'],
    'Venus': eph['venus'],
    'Mars': eph['mars barycenter'],
    'Jupiter': eph['jupiter barycenter'],
    'Saturn': eph['saturn barycenter'],
}
# Add all 58 nav stars as sight targets
for name in star_names:
    body_map[name] = make_star(NAV_STARS[name])

print(f"Generating {N} sight reduction reference readings...")
sight_rows = []
for i in range(N):
    dt = random_date()
    t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
    loc_name, lat, lon = random.choice(locations)
    body_name = random.choice(list(body_map.keys()))
    body = body_map[body_name]

    observer = earth + Topos(latitude_degrees=lat, longitude_degrees=lon)
    obs = observer.at(t).observe(body)
    alt, az, _ = obs.apparent().altaz()

    # Geocentric SHA/Dec
    geo = earth.at(t).observe(body).apparent()
    ra, dec, _ = geo.radec(epoch='date')
    sha = (360 - ra._degrees) % 360

    sight_rows.append({
        'utc': t.utc_iso(),
        'location': loc_name,
        'obs_lat': lat,
        'obs_lon': lon,
        'body': body_name,
        'alt_deg': round(alt.degrees, 5),
        'az_deg': round(az.degrees, 5),
        'sha_deg': round(sha, 5),
        'dec_deg': round(dec.degrees, 5),
    })

with open('sight_reduction_ref.csv', 'w', newline='') as f:
    fields = ['utc', 'location', 'obs_lat', 'obs_lon', 'body',
              'alt_deg', 'az_deg', 'sha_deg', 'dec_deg']
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(sight_rows)
print(f"  → sight_reduction_ref.csv: {len(sight_rows)} sightings")

# ── Lunar distance reference (Moon-body geocentric angular distance) ──
moon_body = eph['moon']
lunar_bodies = {
    'Sun': eph['sun'],
    'Venus': eph['venus'],
    'Mars': eph['mars barycenter'],
    'Jupiter': eph['jupiter barycenter'],
    'Regulus': make_star(NAV_STARS['Regulus']),
    'Spica': make_star(NAV_STARS['Spica']),
    'Aldebaran': make_star(NAV_STARS['Aldebaran']),
    'Antares': make_star(NAV_STARS['Antares']),
}

print(f"Generating {N} lunar distance reference readings...")
lunar_rows = []
for i in range(N):
    dt = random_date()
    t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
    body_name = random.choice(list(lunar_bodies.keys()))
    body = lunar_bodies[body_name]

    # Geocentric apparent positions
    moon_app = earth.at(t).observe(moon_body).apparent()
    body_app = earth.at(t).observe(body).apparent()

    # Angular separation
    angle = moon_app.separation_from(body_app)

    lunar_rows.append({
        'utc': t.utc_iso(),
        'body': body_name,
        'dist_deg': round(angle.degrees, 5),
    })

with open('lunar_dist_ref.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['utc', 'body', 'dist_deg'])
    w.writeheader()
    w.writerows(lunar_rows)
print(f"  → lunar_dist_ref.csv: {len(lunar_rows)} readings")

# ── Moon phase (illumination %) reference ─────────────────────
from skyfield.almanac import moon_phase as sf_moon_phase

print(f"Generating {N} moon phase reference readings...")
phase_rows = []
for i in range(N):
    dt = random_date()
    t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)

    # Skyfield moon phase angle (0=new, 90=first quarter, 180=full, 270=last quarter)
    phase_angle = sf_moon_phase(eph, t).degrees
    # Illumination from phase angle: (1 - cos(phase_angle)) / 2
    import math
    illumination = (1 - math.cos(math.radians(phase_angle))) / 2 * 100

    phase_rows.append({
        'utc': t.utc_iso(),
        'phase_angle_deg': round(phase_angle, 3),
        'illumination_pct': round(illumination, 2),
    })

with open('moon_phase_ref.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['utc', 'phase_angle_deg', 'illumination_pct'])
    w.writeheader()
    w.writerows(phase_rows)
print(f"  → moon_phase_ref.csv: {len(phase_rows)} readings")

# ── Rise/set reference (Sun rise/set at various latitudes) ────
from skyfield.almanac import sunrise_sunset

print(f"Generating rise/set reference readings...")
riseset_rows = []
riseset_lats = [0, 20, 35, 45, 55, 64, -33, -55]
# Pick N/8 random dates (one per latitude)
for i in range(N):
    dt = random_date()
    day_start = datetime(dt.year, dt.month, dt.day)
    t0 = ts.utc(day_start.year, day_start.month, day_start.day)
    t1 = ts.utc(day_start.year, day_start.month, day_start.day + 1)

    for lat in riseset_lats:
        loc = Topos(latitude_degrees=lat, longitude_degrees=0.0)
        observer = earth + loc
        try:
            times, events = sunrise_sunset(eph, observer, t0, t1)
            rise_utc = None
            set_utc = None
            for t_evt, evt in zip(times, events):
                dt_evt = t_evt.utc_datetime()
                if evt and rise_utc is None:
                    rise_utc = dt_evt.strftime('%H:%M')
                elif not evt and set_utc is None:
                    set_utc = dt_evt.strftime('%H:%M')
            riseset_rows.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'lat': lat,
                'lon': 0.0,
                'rise': rise_utc or 'polar',
                'set': set_utc or 'polar',
            })
        except Exception:
            riseset_rows.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'lat': lat,
                'lon': 0.0,
                'rise': 'error',
                'set': 'error',
            })

with open('riseset_ref.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['date', 'lat', 'lon', 'rise', 'set'])
    w.writeheader()
    w.writerows(riseset_rows)
print(f"  → riseset_ref.csv: {len(riseset_rows)} readings")

# ── End-to-end fix reference (synthetic sights at known positions) ──
print(f"Generating {N} end-to-end fix reference cases...")
fix_rows = []
for i in range(N):
    dt = random_date()
    t = ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)
    true_lat = random.uniform(-70, 70)
    true_lon = random.uniform(-180, 180)
    observer = earth + Topos(latitude_degrees=true_lat, longitude_degrees=true_lon)

    # Pick 4-6 random bright bodies above 15°
    all_bodies = list(body_map.items())
    sights = []
    for body_name, body in all_bodies:
        obs = observer.at(t).observe(body)
        alt, az, _ = obs.apparent().altaz()
        if alt.degrees > 15 and alt.degrees < 75:
            # Geocentric apparent position for dec/gha
            geo = earth.at(t).observe(body).apparent()
            ra, dec, _ = geo.radec(epoch='date')
            gha_deg = (360 - ra._degrees) % 360
            dec_deg = dec.degrees
            sights.append({
                'body': body_name,
                'alt_deg': round(alt.degrees, 4),
                'az_deg': round(az.degrees, 4),
                'dec_deg': round(dec_deg, 5),
                'gha_deg': round(gha_deg, 5),
            })
    random.shuffle(sights)
    sights = sights[:min(6, len(sights))]

    if len(sights) >= 3:
        # Generate noisy altitude sets
        noise_levels = [0.5, 1.0, 2.0]  # arcmin sigma
        noisy_sights = {}
        for sigma in noise_levels:
            key = f"sights_noise_{str(sigma).replace('.','')}"
            noisy = []
            for s in sights:
                noisy_alt = s['alt_deg'] + random.gauss(0, sigma / 60)  # arcmin -> degrees
                noisy.append(f"{s['body']}:{round(noisy_alt,4)}:{s['az_deg']}:{s['dec_deg']}:{s['gha_deg']}")
            noisy_sights[key] = '|'.join(noisy)

        fix_rows.append({
            'utc': t.utc_iso(),
            'true_lat': true_lat,
            'true_lon': true_lon,
            'num_sights': len(sights),
            'sights': '|'.join(f"{s['body']}:{s['alt_deg']}:{s['az_deg']}:{s['dec_deg']}:{s['gha_deg']}" for s in sights),
            **noisy_sights,
        })

with open('fix_ref.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=[
        'utc', 'true_lat', 'true_lon', 'num_sights', 'sights',
        'sights_noise_05', 'sights_noise_10', 'sights_noise_20',
    ])
    w.writeheader()
    w.writerows(fix_rows)
print(f"  → fix_ref.csv: {len(fix_rows)} cases")

# ── Running fix (DR) reference — observer moves between sights ──
import math as pymath

print(f"Generating {N} running fix (DR) reference cases...")
dr_rows = []

for i in range(N):
    dt = random_date()
    start_lat = random.uniform(-70, 70)
    start_lon = random.uniform(-180, 180)
    course = random.uniform(0, 360)
    speed = random.uniform(4, 12)  # knots

    # Spread sights across 30 minutes
    sight_offsets = sorted([random.uniform(0, 30) for _ in range(6)])  # minutes

    sights = []
    for offset_min in sight_offsets:
        dt_sight = dt + timedelta(minutes=offset_min)
        t = ts.utc(dt_sight.year, dt_sight.month, dt_sight.day,
                    dt_sight.hour, dt_sight.minute, dt_sight.second)

        # DR position at this sight time
        hours = offset_min / 60
        dlat = speed * hours * pymath.cos(pymath.radians(course)) / 60
        dlon = speed * hours * pymath.sin(pymath.radians(course)) / (
            60 * pymath.cos(pymath.radians(start_lat + dlat)))
        obs_lat = start_lat + dlat
        obs_lon = start_lon + dlon

        observer = earth + Topos(latitude_degrees=obs_lat, longitude_degrees=obs_lon)

        # Find visible bodies
        candidates = []
        for body_name, body in body_map.items():
            obs = observer.at(t).observe(body)
            alt, az, _ = obs.apparent().altaz()
            if 15 < alt.degrees < 75:
                geo = earth.at(t).observe(body).apparent()
                ra, dec, _ = geo.radec(epoch='date')
                sha = (360 - ra._degrees) % 360
                candidates.append({
                    'body': body_name,
                    'alt_deg': round(alt.degrees, 4),
                    'az_deg': round(az.degrees, 4),
                    'dec_deg': round(dec.degrees, 4),
                    'gha_deg': round(sha, 4),
                    'offset_sec': round(offset_min * 60),
                })
        if candidates:
            sights.append(random.choice(candidates))

    if len(sights) >= 3:
        # True position = position at latest sight time
        final_offset = sight_offsets[-1]
        hours = final_offset / 60
        dlat = speed * hours * pymath.cos(pymath.radians(course)) / 60
        dlon = speed * hours * pymath.sin(pymath.radians(course)) / (
            60 * pymath.cos(pymath.radians(start_lat + dlat)))
        true_lat = start_lat + dlat
        true_lon = start_lon + dlon

        dt_start = dt + timedelta(minutes=sight_offsets[0])
        dt_end = dt + timedelta(minutes=sight_offsets[-1])
        t_start = ts.utc(dt_start.year, dt_start.month, dt_start.day,
                         dt_start.hour, dt_start.minute, dt_start.second)
        t_end = ts.utc(dt_end.year, dt_end.month, dt_end.day,
                       dt_end.hour, dt_end.minute, dt_end.second)

        sights_str = '|'.join(
            f"{s['body']}:{s['alt_deg']}:{s['az_deg']}:{s['dec_deg']}:{s['gha_deg']}:{s['offset_sec']}"
            for s in sights
        )
        dr_rows.append({
            'utc_start': t_start.utc_iso(),
            'utc_end': t_end.utc_iso(),
            'true_lat': round(true_lat, 5),
            'true_lon': round(true_lon, 5),
            'course': round(course, 1),
            'speed': round(speed, 1),
            'num_sights': len(sights),
            'sights': sights_str,
        })

with open('fix_dr_ref.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=[
        'utc_start', 'utc_end', 'true_lat', 'true_lon',
        'course', 'speed', 'num_sights', 'sights',
    ])
    w.writeheader()
    w.writerows(dr_rows)
print(f"  → fix_dr_ref.csv: {len(dr_rows)} cases")

print("\nDone. Reference data generated from Skyfield + JPL DE440s.")
sys.stdout.flush()

# ── Run the benchmark ─────────────────────────────────────────
import subprocess
print("\n" + "═" * 50)
print("Running benchmark.js...")
print("═" * 50 + "\n", flush=True)
script_dir = os.path.dirname(os.path.abspath(__file__)) or "."
result = subprocess.run(["node", "benchmark.js"], cwd=script_dir)
sys.exit(result.returncode)
