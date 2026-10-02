/**
 * LongManLoc E-WARRANTY BASE - Global Main Script
 */

function toggleProfileDropdown(event) {
    if (event) {
        event.stopPropagation();
    }
    const menu = document.getElementById('userProfileMenu');
    if (menu) {
        menu.classList.toggle('show');
        menu.classList.toggle('active');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Global click listener to close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('userProfileMenu');
        if (menu && (menu.classList.contains('show') || menu.classList.contains('active'))) {
            if (!menu.contains(event.target)) {
                menu.classList.remove('show');
                menu.classList.remove('active');
            }
        }
    });

    // Make sure dropdown clicks don't close the dropdown itself when interacting with items
    const dropdownContent = document.querySelector('.profile-dropdown-content');
    if (dropdownContent) {
        dropdownContent.addEventListener('click', function(event) {
            event.stopPropagation();
        });
    }
});
