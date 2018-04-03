class WelcomeController < ApplicationController
  before_action :check_user, only: :index

  def index; end

  def rules; end

  private

  def check_user
    redirect_to users_path(current_boy.id) if current_boy
    #redirect_to main_boy_path if current_boy
    redirect_to users_path(current_girl.id) if current_girl
    #redirect_to main_girl_path if current_girl
    redirect_to main_admin_path if current_admin
  end
end
