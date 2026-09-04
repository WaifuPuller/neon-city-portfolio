===============================================================================
  DROP YOUR IMAGES IN THIS FOLDER
===============================================================================

You do NOT have to edit any code to add an image. Name the file correctly,
drop it in here, save, and it appears in the game.


BUILDING IMAGES  (up to 10)
---------------------------

    building-01.jpg
    building-02.jpg
    building-03.jpg
    ...up to...
    building-10.jpg

    Each one becomes a glowing panel that slowly circles one of the towers,
    spread out along the route the player walks.

    Add one file or ten - it makes no difference. Whatever is here is what
    shows up. Nothing is left as an empty placeholder.

    The numbers only control the ORDER, so use 01, 02, 03 (not 1, 2, 3) or
    building-10 will sort before building-2.


THE ORBITER IMAGE  (1)
----------------------

    orbiter.jpg

    This is the image carried by the spaceship (or asteroid) that circles the
    outside of the map. Leave it out and the ship still flies, just with no
    banner on the side.


WHICH FILE TYPES WORK
---------------------

    .jpg    .jpeg    .png    .webp

    Any of them. Mix them freely - building-01.png and building-02.jpg side
    by side is fine.


HOW BIG SHOULD THEY BE?
-----------------------

    Aim for about 1024 x 1024 pixels or smaller, and use .jpg for photos.

    These are loaded onto the graphics card, where a picture takes up room
    based on its DIMENSIONS, not its file size. A 4000px photo eats roughly
    16x the memory of a 1000px one even if it is the same number of megabytes
    on disk, and that is what makes phones stutter.

    Any shape works - tall, wide or square. The panel resizes to match.


WANT TO CHANGE HOW THEY BEHAVE?
-------------------------------

    src/config/media.ts  has the settings: building colours, whether panels
    circle the towers or sit still, and the spaceship's size, speed, height
    and shape. It is commented throughout.

===============================================================================
