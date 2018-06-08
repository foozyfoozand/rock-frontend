// This will contact the server, run the _server route, and the value provided
// here will be used in the server.html template as the loop count variable
// to determine how many server forms should be made. (IE if the user types
// 5 in Number of Servers it will be transfered as the variable server_count)
// here.

// Adding this allows this code to be identified in a browser debugger
//@ sourceURL=button_reaction_gather_device_facts.js

// args[0] correlates to server_{{ i + 1}}_cpus_available in server.html
// args[1] correlates to server_{{ i + 1}}_memory_available in server.html
// args[2] correlates to server_{{ i + 1}}_disk_space_available in server.htmlHolde
// args[3] correlates to server_{{ i + 1}}_hostname in server.html
// args[4] correlates to i (the server number) in server.html
// args[5] correlates to the word server or sensor in server.html or sensor.html respectively

$.getJSON("{{ url_for('_gather_device_facts') }}", { management_ip: $( 'input[name={{ object.field_id }}]' ).val() }, function(data){

  current_total_cpus = data.cpus_available + parseInt($( "#{{ object.args[5] }}_cpus_available" ).text());
  $( "#{{ object.args[5] }}_cpus_available" ).replaceWith('<span id="{{ object.args[5] }}_cpus_available">' + current_total_cpus + '</span>');

  current_total_memory = data.memory_available + parseFloat($( "#{{ object.args[5] }}_memory_available" ).text());
  $( "#{{ object.args[5] }}_memory_available" ).replaceWith('<span id="{{ object.args[5] }}_memory_available">' + current_total_memory.toFixed(2) + '</span>');

  current_total_system_cpus = data.cpus_available + parseInt($( "#system_cpus_available" ).text());
  $( "#system_cpus_available" ).replaceWith('<span id="system_cpus_available">' + current_total_system_cpus + '</span>');

  current_total_system_memory = data.memory_available + parseFloat($( "#system_memory_available" ).text());
  $( "#system_memory_available" ).replaceWith('<span id="system_memory_available">' + current_total_system_memory.toFixed(2) + '</span>');

  // args[0] correlates to server_{{ i + 1}}_cpus_available in server.html
  $( "#{{ object.args[0] }}" ).replaceWith(data.cpus_available);

  // args[1] correlates to server_{{ i + 1}}_memory_available in server.html
  $( "#{{ object.args[1] }}" ).replaceWith(data.memory_available.toFixed(2));

  var total_disk_space = 0;
  $.each( JSON.parse(data.disks), function( index, value ) {
    total_disk_space = value.size_gb + total_disk_space;
  });

  // args[2] correlates to server_{{ i + 1}}_disk_space_available in server.htmlHolde
  $( "#{{ object.args[2] }}" ).replaceWith(total_disk_space.toFixed(2));

  // args[3] correlates to server_{{ i + 1}}_hostname in server.html
  $( "#{{ object.args[3] }}" ).replaceWith(" - " + data.hostname);

  // args[4] correlates to i (the server number) in server.html
  $.get("{{ url_for('_ceph_drives_list') }}", { disks: data.disks, device_number: {{ object.args[4] }}, isServer: "{{ True if object.args[5] == 'server' else False }}" }, function(data){
    // The hide method is here because effects only work if the element
    // begins in a hidden state
    $( "#{{ [object.args[5] + '_ceph_drive_list', object.args[4]] | join('_') }}" ).html(data).hide().slideDown("slow");
  });

  // This causes the gather facts button and the number of servers button to be
  // disabled so that users can't accidentally blow away their own form data
  /*if(current_total_cpus > 0) {
    $( "#{{ object.button_id }}" ).prop( "disabled", true );
    $( "#{{ object.field_id }}" ).prop( "disabled", true );
    {% if object.args[5] == "server" %}
    $( "#{{ form.number_of_servers.button_id }}" ).prop( "disabled", true );
    $( "#{{ form.number_of_servers.field_id }}" ).prop( "disabled", true );
    {% else %}
    $( "#{{ form.number_of_sensors.button_id }}" ).prop( "disabled", true );
    $( "#{{ form.number_of_sensors.field_id }}" ).prop( "disabled", true );
    {% endif %}
  }*/

  // This section is for facts specific to only the sensor.
  {% if object.args[5] == 'sensor' %}
    $.get("{{ url_for('_display_monitor_interfaces') }}", { interfaces: JSON.stringify(data.potential_monitor_interfaces), instance_number: {{ object.args[4] }} }, function(data){
      // The hide method is here because effects only work if the element
      // begins in a hidden state
      $( "#{{ form.sensor_monitor_interface }}_{{ object.args[4] }}" ).html(data).hide().slideDown("slow");
    });

    // Configure Sensor Moloch Threads
    var moloch_threads = Math.round(current_total_cpus * (2/3));
    if (moloch_threads < 1) {
      moloch_threads = 1;
    }

    // Configure Sensor Bro Threads
    var bro_workers = Math.round(current_total_cpus * (1/3));
    if (bro_workers < 1) {
      bro_workers = 1;
    }

    $( "#{{ form.moloch_threads.field_id + '_' }}{{ object.args[4] }}" ).val(moloch_threads);
    $( "#{{ form.bro_workers.field_id + '_' }}{{ object.args[4] }}" ).val(bro_workers);

  {% endif %}

  // This section is for facts specific to only the server
  {% if object.args[5] == 'server' %}
  elastic_available_cpus = Math.round(current_total_system_cpus * (9/10));
  elastic_available_memory = Math.round(current_total_system_memory * (9/10));

  {% endif %}

});
