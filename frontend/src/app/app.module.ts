import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { TopNavbarComponent } from './top-navbar/top-navbar.component';
import { KickstartFormComponent } from './kickstart-form/kickstart-form.component';
import { AppRoutingModule } from './/app-routing.module';
import { HelpComponent } from './help/help.component';
import { TextInputComponent } from './text-input/text-input.component';
import { DropdownComponent } from './dropdown/dropdown.component';
import { CheckboxComponent } from './checkbox/checkbox.component';
import { ModalDialogComponent } from './modal-dialog/modal-dialog.component';
import { KitFormComponent } from './kit-form/kit-form.component';
import { BasicNodeResourceCardComponent } from './basic-node-resource-card/basic-node-resource-card.component';
import { TotalServerResourcesCardComponent } from './total-server-resources-card/total-server-resources-card.component';
import { TotalSensorResourcesCardComponent } from './total-sensor-resources-card/total-sensor-resources-card.component';
import { CardSelectorComponent } from './card-selector/card-selector.component';
import { TotalSystemResourceCardComponent } from './total-system-resource-card/total-system-resource-card.component';
import { ServerStdoutComponent } from './server-stdout/server-stdout.component';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { environment } from '../environments/environment';

const config: SocketIoConfig = environment.socket_config; // { url: 'http://172.16.77.251:8080', options: {} };

@NgModule({
  declarations: [
    AppComponent,
    TopNavbarComponent,
    KickstartFormComponent,
    HelpComponent,
    TextInputComponent,    
    DropdownComponent,
    CheckboxComponent,
    ModalDialogComponent,
    KitFormComponent,
    BasicNodeResourceCardComponent,
    TotalServerResourcesCardComponent,
    TotalSensorResourcesCardComponent,
    CardSelectorComponent,
    TotalSystemResourceCardComponent,
    ServerStdoutComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    SocketIoModule.forRoot(config) 
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }