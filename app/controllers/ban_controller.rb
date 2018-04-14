class BanController < ApplicationController
  defore_action :check_user

  def banned; end

  private

  def check_user
    redirect_to root_path unless current_user.status == 'banned'
  end
end
