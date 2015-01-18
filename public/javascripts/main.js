
function checkShifts() {
    $.get('/shifts', function (shifts) {
        for (var day in shifts) {
            for (var shift in shifts[day]) {
                var $input = $('#' + day + shift);
                if (shifts[day][shift] <= 0) {
                    $input.prop('disabled', true);
                    if ($input.val() == $('input[name="shift"]:checked').val()) {
                        $input.prop('checked', false);
                        $input.change();
                    }
                    $input.parent().removeClass('btn-warning btn-primary').addClass('btn-danger disabled');
                }
                else if (shifts[day][shift] == 1) {
                    $input.parent().removeClass('btn-primary').addClass('btn-warning');
                }
            }
        }
    });
}

String.prototype.ucfirst = function () {
    return this.charAt(0).toUpperCase() + this.substring(1);
};

checkShifts();
setInterval(checkShifts, 1000);

var currentShift;

$('.days input').change(function () {
    if ($(this).is(':checked')) {
        $('.notifier').show();
        $('.active').removeClass('active');
        $(this).parent().addClass('active');

        currentShift = $(this).val().substring(0, 3).ucfirst() + $(this).parent().text();
        $('.notifier span').text(currentShift);
    } else {
        currentShift = null;
        $('.notifier').hide();
    }
});

$('button.submit').click(function () {
    if ($('#first_name').val() == '' || $('#last_name').val() == '') {
        alert('Please fill in your first and last name.');
        $('#first_name').focus();
        return;
    }

    var $btn = $(this);
    $btn.prop('disabled', true).text('Submitting...');
    $.post('/', {
        first_name: $('#first_name').val(),
        last_name: $('#last_name').val(),
        shift: $('input[name="shift"]:checked').val()
    }, function (data) {
        if (data.error == null) {
            $('.modal').modal({backdrop: 'static'});
            $('.modal span').text(currentShift);
        } else {
            alert(data.error);
            $btn.prop('disabled', false);
            $btn.text('Submit');
        }
    });
});
