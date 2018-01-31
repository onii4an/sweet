class WelcomeController < ApplicationController
  before_action :check_user

  def index; end

  private

  def check_user
    redirect_to main_boy_path if current_boy
    redirect_to main_girl_path if current_girl
  end
end
